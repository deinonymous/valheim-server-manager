#!/bin/bash

# Check if the required number of arguments (3) is provided
if [ $# -ne 3 ]; then
    echo "Usage: $0 <name> <world> <password>"
    exit 1
fi

name="$1"
world="$2"
password="$3"

# Validate password length (minimum 5 characters)
if [ ${#password} -lt 5 ]; then
    echo "Error: Password length should be at least 5 characters."
    exit 1
fi

# Validate if password is part of the server name
if [[ "$name" == *"$password"* ]]; then
    echo "Error: Password should not be part of the server name."
    exit 1
fi

templdpath="$LD_LIBRARY_PATH"
export LD_LIBRARY_PATH=./linux64:$LD_LIBRARY_PATH
export SteamAppId=892970

echo "Starting server. Press CTRL-C to exit"

./valheim_server.x86_64 -name "$name" -port 2456 -world "$world" -password "$password" -public 1

export LD_LIBRARY_PATH="$templdpath"
