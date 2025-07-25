# Run

This page describes how to get Tunarr running with various methods and installation methods.

## Migrating from dizqueTV

!!! tip

    We highly recommend that you use a copy of your `.dizquetv` database directory when starting out with Tunarr. While Tunarr does not alter or overwrite the `.dizquetv` database directory, it is still considered pre-release software and should be treated as such!

Upon first launch, Tunarr will look for a `.dizquetv` folder relative to its working directory and attempt a migration. Tunarr will try and migrate all legacy dizqueTV settings, including channels, programs, Plex servers, etc.

When using Docker, you can mount your a directory named `.dizquetv` when launching Tunarr to initiate the migration.

!!! note

    You can force a legacy migration on subsequent launches of Tunarr using the `--force_migration` flag. But be careful! This can be destructive if you've done any additional configuration in Tunarr.

## Docker

```
docker run \
    -v "$(pwd)"/tunarr:/config/tunarr \
    -v "$(pwd)"/.dizquetv:/.dizquetv \
    -e "TZ=America/New_York" \
    -p 8000:8000 \
    chrisbenincasa/tunarr
```

Or if using `docker compose`...

```yaml title="docker-compose.yml"
version: '3.8'
services:
  tunarr:
    image: chrisbenincasa/tunarr:latest
    container_name: tunarr
    ports:
      - ${TUNARR_SERVER_PORT:-8000}:8000
    # Uncomment if using the Nvidia container
    # runtime: nvidia
    environment:
      - LOG_LEVEL=${TUNARR_LOG_LEVEL:-INFO}
      # Replace this with your timezone to ensure accurate guide
      # data and scheduling.
      - TZ=America/New_York
      # Uncomment if you'd like to adjust default config path
      # - TUNARR_DATABASE_PATH=/your/path/tunarr
    volumes:
      # Choose a path on your host to map to /config/tunarr. This ensures
      # that restarting the container will not delete your settings or DB.
      - /path/to/tunarr/data:/config/tunarr
    # The host path is relative to the location of the compose file
    # This can also use an absolute path.
    #
    # Uncomment if migrating from dizquetv. Chnage the host path
    # to the location of your dizquetv "database"
    # - ./.dizquetv:/.dizquetv
```

### Docker Desktop

If using Docker Desktop, before running the Tunarr container, you have to use the GUI to configure some of the options mentioned above. This can be done by clicking on the "Optional settings" button. This will show the UI below, where, at the very least, you should configure a volume bind mount (so that your configurations don't get deleted if the container restarts / Tunarr is upgraded). Set the "Container path" to `/config/tunarr` and the Host path to the path on your system where you want to save Tunarr data. Additionally, expose the port of your choice to access Tunarr, by setting "Host port" to the port of your choice.

![Docker Desktop Setup](../assets/docker-desktop.webp)

## Configuration

Tunarr has various command line / environment variables for configuration. These are listed below.

| Environment Variable   | Command Line Flag | Default value | Description                                                                                                                                        |
| ---------------------- | ----------------- | ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TUNARR_DATABASE_PATH` | `--database`      | `''`          | Sets the path where Tunarr will write its data to. **NOTE** Do not set this if using docker; use a bind mount pointed to `/config/tunarr` instead. |
| `TUNARR_SERVER_PORT`   | `--port`/`p`      | 8000          | Sets the port that the Tunarr server will listen on. **NOTE** When using Docker prefer using a port mapping than setting this. |
| `TUNARR_SERVER_ADMIN_MODE` | `--admin` | FALSE | Starts Tunarr in [admin mode](/configure/system/security/#admin-mode) | 
| `TUNARR_SERVER_PRINT_ROUTES` | `--print_routes` | FALSE | Prints all of Tunarrs server routes at startup |
| `TUNARR_SERVER_TRUST_PROXY` | `--trust_proxy` | FALSE | Enables [trust proxy](/configure/system/security/#trust-proxy) for using Tunarr behind a reverse proxy |
| `TUNARR_BIND_ADDR` | N/A | `0.0.0.0` | Sets the interface that Tunarr will attempt to bind its server to. **NOTE** Change at your own risk! By default, Tunarr listens on all network interfaces | 
| `TUNARR_USE_WORKER_POOL` | N/A | FALSE | Set to true to enable experimental support for Tunarr's worker threads | 
| `TUNARR_WORKER_POOL_SIZE` | N/A | `cpus().length` | Control the number of worker threads Tunarr creates in its pool. It's recommended to use no more than the number of CPUs on the host system | 

## Hardware Encoding

### Nvidia

There are many ways to enable usage of an Nvidia GPU in a Docker container. The latest, and arguably simplest, method is to install and configure the [Nvidia Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).

#### Docker CLI example with Nvidia

```
docker run \
    --runtime nvidia
    -v "$(pwd)"/tunarr:/config/tunarr \
    -e "TZ=America/New_York" \
    -p 8000:8000 \
    chrisbenincasa/tunarr
```

#### Docker Compose example with Nvidia

```yaml title="docker-compose-nvidia.yml"
version: '3.8'
services:
  tunarr:
    image: chrisbenincasa/tunarr:latest
    container_name: tunarr
    ports:
      - ${TUNARR_SERVER_PORT:-8000}:8000
    runtime: nvidia
    environment:
      - LOG_LEVEL=${TUNARR_LOG_LEVEL:-INFO}
      - NVIDIA_VISIBLE_DEVICES=all
      - TZ=America/New_York
    # Uncomment if you'd like to adjust default config path
    # - TUNARR_DATABASE_PATH=/your/path/tunarr
    volumes:
      # Choose a path on your host to map to /config/tunarr. This ensures
      # that restarting the container will not delete your settings or DB.
      - /path/to/tunarr/data:/config/tunarr
```

### QSV (Intel) / VA-API (Video Acceleration API)

For QSV compatability in Docker, you must mount `/dev/dri` the container:

#### Docker CLI Example

```
docker run \
  -v "$(pwd)"/tunarr:/config/tunarr \
  --device /dev/dri:/dev/dri \
  -e "TZ=America/New_York" \
  -p 8000:8000 \
  chrisbenincasa/tunarr:latest
```

#### Docker Compose Example

```yaml title="docker-compose-vaapi.yml"
version: '3.8'
services:
  tunarr:
    image: chrisbenincasa/tunarr:latest
    container_name: tunarr
    ports:
      - ${TUNARR_SERVER_PORT:-8000}:8000
    environment:
      - LOG_LEVEL=${TUNARR_LOG_LEVEL:-INFO}
      - TZ=America/New_York
    # Pass all render devices to container
    devices:
      - /dev/dri:/dev/dri
    volumes:
      # Choose a path on your host to map to /config/tunarr. This ensures
      # that restarting the container will not delete your settings or DB.
      - /path/to/tunarr/data:/config/tunarr
```

## Standalone binaries

### \*nix Setup

After downloading the binary from Github, you must re-add executable permissions to the file. In Linux or macOS, this can be done by running

```
chmod +x ./tunarr-linux-64
```

Replace `tunarr-linux-64` with the path to the Tunarr binary you downloaded.

### Run as a service

It's recommended to run Tunarr as a service / background task. Below are examples depending on your host OS.

#### systemd (Linux)

Below is a sample systemd service definition that can be used as a starting point to running Tunarr via systemd on Linux.

Setup:

1. In terminal, execute `sudo mkdir /opt/tunarr/`
2. Execute `sudo mkdir /opt/tunarr/streams`
3. Execute a `sudo mv tunarr-linux-x64 /opt/tunarr/tunarr-linux-x64` (replace the first path with the path you downloaded Tunarr too, which will include the version)
4. Execute `sudo nano /etc/systemd/tunarr.service`
5. Copy and paste the service definition below:

```systemd
[Unit]
Description=Tunarr
Wants=network-online.target
After=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/tunarr
ExecStart=bash /opt/tunarr/tunarr-linux-x64
ExecReload=pkill tunarr-linux-x64
ExecStop=pkill tunarr-linux-x64
KillMode=process
Restart=always
RestartSec=15

# Replace these values!
User=YOUR_USER
Group=YOUR_GROUP

StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

6. Execute a `ctrl+o`, on the keyboard. When prompted to save the buffer, press Enter to save and exit.
7. Execute `sudo systemctl daemon-reload`
8. In terminal, execute `sudo systemctl enable tunarr.service`
9. Execute `sudo systemctl start tunarr`

#### launchd (macOS)

Save the following launchd configuration to `~/Library/LaunchAgents/tunarr.xml`. Replace `/Path/to/tunarr` with the directory path in which you installed Tunarr. We recommend moving this to somewhere stable (i.e. out of your Downloads folder) like `$HOME/.local/bin`

```xml
<?xml version=“1.0” encoding=“UTF-8”?>
<!DOCTYPE plist PUBLIC “-//Apple//DTD PLIST 1.0//EN” “http://www.apple.com/DTDs/PropertyList-1.0.dtd”>
<plist version=“1.0”>
<dict>
    <key>Label</key>
    <string>com.tunarr.server.app</string>
    <key>Program</key>
    <string>/Path/to/tunarr/tunarr</string>
    <key>WorkingDirectory</key>
    <string>/Path/to/tunarr</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardErrorPath</key>
    <string>/Path/to/tunarr/error.log</string>
    <key>StandardOutPath</key>
    <string>/Path/to/tunarr/output.log</string>
    <key>UserName</key>
    <string>USER_TO_RUN_TUNARR_AS</string>
    <key>HOME</key>
    <string>/Path/to/home</string>
</dict>
</plist>
```

#### NSSM (Windows)

[NSSM](https://nssm.cc/) is the recommended way to run Tunarr as a background task in Windows. It is recommended to configure NSSM to run Tunarr as the currently logged in user.
