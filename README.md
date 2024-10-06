i ran this to update the server:

```
sudo chown -R johntheller:johntheller /home/valheim
/home/g2keatontheller/steamcmd/steamcmd.sh +force_install_dir /home/valheim +login anonymous +app_update 896660 validate +quit
```

### create the volume

```
docker volume create valheim_worlds
```

### replace worlds on valheim volume with local worlds (run on vm)

```
sudo docker run --rm -v valheim_worlds:/worlds -v /root/.config/unity3d/IronGate/Valheim/worlds_local/:/backup busybox sh -c "cp -r /backup/. /worlds/"
```

### tarball the volume

```
sudo docker run --rm -v valheim_worlds:/worlds -v ./worlds_local:/backup busybox tar czf /backup/valheim_worlds_backup.tar.gz -C /worlds .
```

push up tarball

```
gsutil cp ./worlds_local/valheim_worlds_backup.tar.gz gs://valheim-server_world-backups/
```

pull down tarball
gsutil cp gs://valheim-server_world-backups/valheim_worlds_backup.tar.gz ./worlds_local/valheim_worlds_backup.tar.gz

```
docker run --rm -v valheim_worlds:/worlds -v ./worlds_local:/backup busybox tar xzf /backup/valheim_worlds_backup.tar.gz -C /worlds
```

docker build -t valheim-server-backend .
docker run -p 2456:2456/udp -p 2457:2457/udp -p 2458:2458/udp -p 3000:3000/tcp -it valheim-server-backend
