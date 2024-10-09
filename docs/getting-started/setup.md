# Setup

## Running Tunarr in Docker

```
docker run \
    -v "$(pwd)"/tunarr:/config/tunarr \
    -v "$(pwd)"/.dizquetv:/.dizquetv \
    -p 8000:8000 \
    chrisbenincasa/tunarr
```

Or if using `docker compose`...

```yaml title="docker-compose.yml"
version: '3.8'
services:
  tunarr:
    image: chrisbenincasa/tunarr
    # Uncomment along with runtime below to enable HW accel
    # image: chrisbenincasa/tunarr:latest-nvidia
    container_name: tunarr
    ports:
      - ${TUNARR_SERVER_PORT:-8000}:8000
    # Uncomment if using the Nvidia container
    # runtime: nvidia
    environment:
      - LOG_LEVEL=${TUNARR_LOG_LEVEL:-INFO}
    # Uncomment if you'd like to adjust default config path
    # - TUNARR_DATABASE_PATH=/your/path/tunarr
    # volumes:
    # The host path is relative to the location of the compose file
    # This can also use an absolute path.
    #
    # Uncomment if migrating from dizquetv. Chnage the host path
    # to the location of your dizquetv "database"
    # - ./.dizquetv:/.dizquetv
```

## Migrating from dizqueTV

!!! tip

    We highly recommend that you use a copy of your `.dizquetv` database directory when starting out with Tunarr. While Tunarr does not alter or overwrite the `.dizquetv` database directory, it is still considered pre-release software and should be treated as such!

Upon first launch, Tunarr will look for a `.dizquetv` folder relative to its working directory and attempt a migration. Tunarr will try and migrate all legacy dizqueTV settings, including channels, programs, Plex servers, etc.

When using Docker, you can mount your a directory named `.dizquetv` when launching Tunarr to initiate the migration.

!!! note

    You can force a legacy migration on subsequent launches of Tunarr using the `--force_migration` flag. But be careful! This can be destructive if you've done any additional configuration in Tunarr.

## Hardware Encoding

### Nvidia

There are many ways to enable usage of an Nvidia GPU in a Docker container. The latest, and arguably simplest, method is to install and configure the [Nvidia Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html).

### QSV (Intel iGPUs)

For QSV compatability in Docker, you must mount `/dev/dri` the container:

```

docker run \
 -v "$(pwd)"/tunarr:/config/tunarr \
 --device /dev/dri:/dev/dri
-p 8000:8000 \
 chrisbenincasa/tunarr:latest-vaapi

```

## Initial Setup

Upon first launching Tunarr, you will see the Welcome page with a few required setup steps.

![Welcome Page Plex-Jellyfin](../assets/add-media-source.png)

### Media Sources

Currently, Tunarr supports Plex and Jellyfin as media sources. In order to add programming to your channels, you must connect at least one media source. Each media source acts as a metadata source for your programming, and optionally, the streaming source.

Click the "Add" button, followed by your source. For Plex, you can choose Auto to perform automatic web authentication. Alternatively, you can select Manual, input your URL (http://serverIP:32400) and [Access Token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/). Unless you have a specific reason for doing so, leave Auto-Update Guide and Auto-Update Channels unchecked. If communication with your server is successful, you should see a green checkmark cloud icon next to your server URL.

![Manual Plex server](../assets/new-plex-server-manual.png)

!!! info

    We plan on implementing other media source types, including [Emby](https://github.com/chrisbenincasa/tunarr/issues/25) and [Local Media](https://github.com/chrisbenincasa/tunarr/issues/26). Upvote and follow the issues you'd like to see us implement!

### FFMPEG

Tunarr also requires [FFMPEG](https://ffmpeg.org/). FFMPEG is used to normalize channel video / audio streams for seamless playback, interleave your "flex" content, and more. Tunarr defaults to looking for the FFMPEG executable at `/usr/bin/ffmpeg`. If no executable is found, you can change the path in the FFMPEG settings page.

Please note that FFMPEG is built into the Docker image, so Docker users should not need to make any adjustments to this page.

![Welcome Page With FFMPEG](../assets/welcome_page_ffmpeg_installed.png)

Click "FINISH" and you will be brought to the new channel page to [create your first channel](/configure/channels/properties).

![Finish](../assets/setup-finish.png)

```

```
