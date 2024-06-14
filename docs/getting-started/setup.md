# Setup

## Migrating from dizqueTV

!!! tip

    We highly recommend that you use a copy of your `.dizquetv` database directory when starting out with Tunarr. While Tunarr does not alter or overwrite the `.dizquetv` database directory, it is still considered pre-release software and should be treated as such!

Upon first launch, Tunarr will look for a `.dizquetv` folder relative to its working directory and attempt a migration. Tunarr will try and migrate all legacy dizqueTV settings, including channels, programs, Plex servers, etc.

When using Docker, you can mount your a directory named `.dizquetv` when launching Tunarr to initiate the migration.

```
docker run \
    -v "$(pwd)"/.dizquetv:/.dizquetv \
    -p 8000:8000 \
    chrisbenincasa/tunarr:edge
```

Or if using `docker compose`...

```yaml title="docker-compose.yml"
version: '3.8'
services:
  tunarr:
    image: chrisbenincasa/tunarr:edge
    # Uncomment along with runtime below to enable HW accel
    # image: chrisbenincasa/tunarr:edge-nvidia
    container_name: tunarr
    ports:
      - ${TUNARR_SERVER_PORT:-8000}:8000
    # Uncomment if using the Nvidia container
    # runtime: nvidia
    environment:
      - LOG_LEVEL=${TUNARR_LOG_LEVEL:-INFO}
    # volumes:
    # The host path is relative to the location of the compose file
    # This can also use an absolute path.
    #
    # Uncomment if migrating from dizquetv. Chnage the host path
    # to the location of your dizquetv "database"
    # - ./.dizquetv:/.dizquetv
```

!!! note

    You can force a legacy migration on subsequent launches of Tunarr using the `--force_migration` flag. But be careful! This can be destructive if you've done any additional configuration in Tunarr.

## Initial Setup

Upon first launching Tunarr, you will see the Welcome page with a few required setup steps.

![Welcome Page No Plex](/assets/welcome_page_not_connected.png)

### Plex

Currently, Tunarr supports a single media source, Plex. In order to add programming to your channels, you must connect at least one Plex server. Plex acts as the metadata source for your programming, and optionally, the streaming source. Click the "Connect Plex" button to start Plex authentication and add your first Plex server to Tunarr.

!!! info

    We plan on implementing other media source types, including [Jellyfin](https://github.com/chrisbenincasa/tunarr/issues/24) and [Local Media](https://github.com/chrisbenincasa/tunarr/issues/26). Upvote and follow the issues you'd like to see us implement!

### FFMPEG

Tunarr also requires [FFMPEG](https://ffmpeg.org/). FFMPEG is used to normalize channel video / audio streams for seamless playback, interleave your "flex" content, and more. Tunarr defaults to looking for the FFMPEG executable at `/usr/bin/ffmpeg`. If no executable is found, you can change the path in the FFMPEG settings page.

![Welcome Page With FFMPEG](/assets/welcome_page_ffmpeg_installed.png)
