const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const express = require('express');
const { exec } = require('child_process');
const dotenv = require('dotenv');
const os = require('os');

dotenv.config();
const DEV = process.env.NODE_ENV === 'development';
const WORLDS_DIR = process.env.WORLDS_DIR;
const PROXY_ADDRESS = DEV
  ? 'http://localhost:8081'
  : 'https://vm-manager-server-iadd624u5a-uc.a.run.app';

const getIPAddress = () => {
  if (DEV) {
    return 'localhost';
  }
  const interfaces = os.networkInterfaces();
  for (let interfaceName in interfaces) {
    for (let iface of interfaces[interfaceName]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1'; // fallback to localhost if no external IP found
};

const useSudo = DEV ? '' : 'sudo ';

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const MAX_INACTIVITY_MS = 15 * 60 * 1000;

const serverState = {
  running: false,
  msSinceActivity: 0,
  udpPackets: 0
};

const serverSettings = JSON.parse(fs.readFileSync('./config.json'));

const GAME_SERVER_PATH = fs.realpathSync('../');

const commands = () => ({
  start:
    `${useSudo}tmux new -d -s valheim_server ` +
    `"cd ${GAME_SERVER_PATH} && ./start.sh ${serverSettings.name} ${serverSettings.worldName} \\"${serverSettings.password}\\""`,
  stop: `${useSudo}tmux send-keys -t valheim_server C-c`,
  checkRunning: `${useSudo}tmux list-sessions | grep valheim_server`,
  checkConnections: "nstat | awk '/UdpInDatagrams/{print $2}' | tr -d ' '",
  showServerOutput: `${useSudo}tmux capture-pane -p -S 0 -E 50 -t valheim_server`
});

const runCommand = (cmd) => {
  return new Promise((resolve, reject) => {
    exec(cmd, (error, stdout, stderr) => {
      if (error || stderr) {
        console.error(`Error running command ${cmd}.`);
        return reject(error);
      }
      resolve(stdout);
    });
  });
};

function getWorldNames() {
  const worldSaveDirectory = WORLDS_DIR;
  let worldNames = [];

  const fileIsWorldSave = (file) => {
    return (
      file.endsWith('.fwl') && //Valheim world files have a .fwl extension
      !file.includes('_backup_auto') //Ignore backups of worlds
    );
  };

  try {
    const files = fs.readdirSync(worldSaveDirectory);
    files.forEach((file) => {
      if (fileIsWorldSave(file)) {
        worldNames.push(file.split('.fwl')[0]);
      }
    });
  } catch (err) {
    console.error('Error reading world names:', err);
  }

  return worldNames;
}

const start = async () => {
  if (serverState.running === false) {
    await runCommand(commands().start)
      .then((res) => {
        console.log(res);
        serverState.running = true;
      })
      .catch((e) => {
        console.error(e);
      });
  }
};

const stop = async () => {
  console.log('Stopping the server...');
  try {
    await runCommand(commands().stop)
      .then(async () => {
        serverState.running = false;
        console.log('Server stopped.');
        await requestBackup();
      })
      .catch((e) => {
        console.error(e);
      });
  } catch (e) {
    console.error('Error stopping the server:', e);
  }
};

const requestBackup = async () => {
  if (!serverSettings.worldName) {
    console.error('Error backing up the world: No world name provided.');
  }
  const exts = ['.db', '.fwl'];
  for (const ext of exts) {
    const filePath = path.join(WORLDS_DIR, `${serverSettings.worldName}${ext}`);
    if (fs.existsSync(filePath)) {
      // Create a FormData object to hold the file
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath));

      // Send the file to the target server
      const targetUrl = PROXY_ADDRESS + '/server/worlds/backup';
      await axios.post(targetUrl, form, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-Api-Key': process.env.API_KEY
        }
      });
    }
  }
};

const stopVmByRequest = async () => {
  try {
    try {
      await requestBackup();
    } catch (e) {
      console.error('Error backing up the world:', e);
    }
    await fetch(PROXY_ADDRESS + '/vm/stop', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.API_KEY
      }
    });
  } catch (error) {
    console.error('Error stopping the VM:', error);
  }
};

const check = async () => {
  serverState.running = undefined;
  await runCommand(commands().checkRunning)
    .then((res) => {
      serverState.running = res && res.includes('valheim_server:');
    })
    .catch((e) => {
      console.error('The server is not running.');
      serverState.running = false;
    });
};

const getServerOutput = async () => {
  const output = await runCommand(commands().showServerOutput)
    .then((res) => {
      return res;
    })
    .catch((e) => {
      console.error("Couldn't get server output.");
    });
  return output;
};

const monitor = (interval) => {
  setInterval(async () => {
    await runCommand(commands().checkConnections).then((res) => {
      console.log('udp packets:', res);
      serverState.udpPackets = Number(res);
      serverState.msSinceActivity +=
        !res || Number(res) < 600 ? interval : -serverState.msSinceActivity;
    });
    console.log('ms since activity:', serverState.msSinceActivity);
    if (serverState.msSinceActivity >= MAX_INACTIVITY_MS) {
      stopVmByRequest();
    }
  }, interval);
};

const updateSettings = (settings) => {
  Object.keys(settings).forEach((key) => {
    serverSettings[key] = settings[key];
  });
  serverSettings.name = settings.serverName;
  fs.writeFileSync('./config.json', JSON.stringify(serverSettings, null, 2));
};

app.post('/start', async (req, res) => {
  console.log(req.body);
  try {
    updateSettings(req.body);
    await start();
    res.send({ serverState });
  } catch (error) {
    res.status(500).send('Error starting the Valheim server.');
  }
});

app.post('/stop', async (req, res) => {
  try {
    await stop();
    res.send({ serverState });
  } catch (error) {
    res.status(500).send('Error stopping the Valheim server.');
  }
});

app.get('/status', async (req, res) => {
  try {
    await check();
  } catch (e) {
    console.error(e);
  }
  console.log('serverState:', serverState);
  console.log('serverSettings:', serverSettings);
  res.status(200).send({ serverState, serverSettings });
});

app.get('/worlds', async (req, res) => {
  try {
    const worldNames = getWorldNames();
    res.status(200).send({ worldNames });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error getting world names.');
  }
});

app.get('/output', async (req, res) => {
  try {
    const output = await getServerOutput();
    res.status(200).send({ output });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error getting server output.');
  }
});

app.post('/notify', async (req, res) => {
  try {
    serverState.msSinceActivity = 0;
    updateSettings(req.body);
    res.status(200).send({ serverSettings });
  } catch (e) {
    console.error(e);
    res.status(500).send('Error setting notification.');
  }
});

app.listen(port, async () => {
  try {
    console.log(
      `Valheim server manager running at http://${getIPAddress()}:${port}`
    );
    monitor(60 * 1000);
  } catch (error) {
    console.error('Error initializing the Valheim server manager.');
  }
});
