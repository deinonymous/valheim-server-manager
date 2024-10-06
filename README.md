i ran this to update the server:

```
sudo chown -R johntheller:johntheller /home/valheim
/home/g2keatontheller/steamcmd/steamcmd.sh +force_install_dir /home/valheim +login anonymous +app_update 896660 validate +quit
```

running the DST server:

```
sudo tmux new -d -s dst_server_master \
"cd /home/dont-starve-together/bin64/ \
&& sudo -u johntheller ./dontstarve_dedicated_server_nullrenderer_x64 -cluster TheGreatPunkin -shard Master" \
&& sudo tmux new -d -s dst_server_caves \
"cd /home/dont-starve-together/bin64/ \
&& sudo -u johntheller ./dontstarve_dedicated_server_nullrenderer_x64 -cluster TheGreatPunkin -shard Caves"
```
