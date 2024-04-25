# Setup

## Migrating from dizqueTV

!!! tip

    We highly recommend that you use a copy of your `.dizquetv` database directory when starting out with Tunarr. While Tunarr does not alter or overwrite the `.dizquetv` database directory, it is still considered pre-release software and should be treated as such!

Upon first launch, Tunarr will look for a `.dizquetv` folder relative to its working directory and attempt a migration. Tunarr will try and migrate all legacy dizqueTV settings, including channels, programs, Plex servers, etc.

When using Docker, you can mount your a directory named `.dizquetv` when launching Tunarr to initiate the migration.

```bash
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
    container_name: tunarr
    ports:
      - '8000:8000'
    # Uncomment if using the Nvidia container
    # runtime: nvidia
    volumes:
      # The host path is relative to the location of the compose file
      # This can also use an absolute path.
      - ./.dizquetv:/.dizquetv
```

!!! note

    You can force a legacy migration on subsequent launches of Tunarr using the `--force_migration` flag. But be careful! This can be destructive if you've done any additional configuration in Tunarr.

## Configuring Plex server sources

## Configuring FFMPEG
