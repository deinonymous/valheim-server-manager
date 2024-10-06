FROM ubuntu:latest

WORKDIR /valheim

RUN apt update && apt install -y \
    software-properties-common
RUN add-apt-repository multiverse
RUN dpkg --add-architecture i386
RUN echo steam steam/question select "I AGREE" | debconf-set-selections; \
    echo steam steam/license note '' | debconf-set-selections
RUN apt update && apt install -y \
    nodejs \
    npm \
    steamcmd \
    libatomic1 \
    libpulse-dev \
    libpulse0 \
    iproute2 \
    tmux \
    tar

RUN /usr/games/steamcmd +force_install_dir /valheim +login anonymous +app_update 896660 validate +exit

COPY . /valheim/
COPY worlds_local/valheim_worlds_backup.tar.gz /valheim/worlds/

# Extract the tarball
RUN mkdir -p /root/.config/unity3d/IronGate/Valheim/worlds_local \
    && tar -xzf /valheim/worlds/valheim_worlds_backup.tar.gz -C /root/.config/unity3d/IronGate/Valheim/worlds_local


WORKDIR /valheim/server-manager

RUN npm install

EXPOSE 2456/udp
EXPOSE 2457/udp
EXPOSE 2458/udp

EXPOSE 3000/tcp

CMD ["npm", "run", "dev"]