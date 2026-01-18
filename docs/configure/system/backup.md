# Backup & Restore

Tunarr provides a backup system that creates compressed archives of your configuration, database, and media assets. Backups can be scheduled to run automatically or triggered manually.

## What Gets Backed Up

A Tunarr backup archive includes:

| Item | Description |
|------|-------------|
| `db.db` | SQLite database containing channels, programs, and configuration |
| `settings.json` | System settings and media source configurations |
| `channel-lineups/` | Channel lineup data and M3U files |
| `images/` | Channel logos, artwork, and thumbnails |
| `cache/` | Cached subtitles, posters, banners, fanart, and watermarks |
| `ms-snapshots/` | Meilisearch index snapshots (optional) |
| `*.xml` | XMLTV output files |

## Configuration

Backup settings can be configured in the Tunarr web UI under **Settings > System > Backup**, or via the API.

### Backup Options

| Option | Default | Description |
|--------|---------|-------------|
| **Enabled** | `true` | Enable or disable scheduled backups |
| **Schedule** | Daily at 4:00 AM | When to run automatic backups |
| **Output Path** | `{data directory}/backups/` | Where backup files are stored |
| **Archive Format** | `tar` | Archive format: `tar` or `zip` |
| **Gzip Compression** | `false` | Enable gzip compression (tar only) |
| **Max Backups** | `3` | Number of backups to retain before deleting oldest |

### File Naming

Backup files are named using a timestamp format:

```
tunarr-backup-YYYYMMDD_HHmmss.tar
tunarr-backup-YYYYMMDD_HHmmss.tar.gz  (with gzip)
tunarr-backup-YYYYMMDD_HHmmss.zip
```

Example: `tunarr-backup-20250118_040000.tar.gz`

## Scheduling

Backups can be scheduled in two ways:

### Interval-Based

Run backups at regular intervals:

- Every N hours
- Every N days

Example: "Every 1 day at 4:00 AM"

### Cron-Based

Use a cron expression for more complex schedules:

```
0 4 * * *    # Daily at 4:00 AM
0 */6 * * *  # Every 6 hours
0 4 * * 0    # Weekly on Sunday at 4:00 AM
```

## Manual Backup

### Via Web UI

Navigate to **Settings > System > Backup** and click the **Backup Now** button.

### Via API

Trigger a backup using the tasks API:

```bash
curl -X POST "http://localhost:8000/api/tasks/BackupTask/run"
```

To run the backup in the background (recommended for large installations):

```bash
curl -X POST "http://localhost:8000/api/tasks/BackupTask/run?background=true"
```

## Backup Retention

When a new backup is created and the total number of backups exceeds the `maxBackups` setting, the oldest backups are automatically deleted. This helps prevent disk space from filling up over time.

## Restore

!!! warning "Manual Process"
    Tunarr does not currently have a built-in restore feature. Restoration must be done manually.

### Restore Steps

1. **Stop Tunarr** - Ensure the Tunarr server is not running

2. **Locate your data directory**:
    - **Docker**: The path you mounted to `/config/tunarr`
    - **Windows**: `%APPDATA%\tunarr`
    - **macOS**: `~/Library/Preferences/tunarr`
    - **Linux**: `~/.local/share/tunarr`

3. **Extract the backup archive**:

    ```bash
    # For tar archives
    tar -xvf tunarr-backup-YYYYMMDD_HHmmss.tar -C /path/to/restore/

    # For gzipped tar archives
    tar -xzvf tunarr-backup-YYYYMMDD_HHmmss.tar.gz -C /path/to/restore/

    # For zip archives
    unzip tunarr-backup-YYYYMMDD_HHmmss.zip -d /path/to/restore/
    ```

4. **Copy files to the data directory**:

    ```bash
    # Required files
    cp /path/to/restore/db.db /path/to/tunarr/data/
    cp /path/to/restore/settings.json /path/to/tunarr/data/

    # Optional directories (restore as needed)
    cp -r /path/to/restore/images/ /path/to/tunarr/data/
    cp -r /path/to/restore/cache/ /path/to/tunarr/data/
    cp -r /path/to/restore/channel-lineups/ /path/to/tunarr/data/
    ```

5. **Start Tunarr** - The search index will rebuild automatically if not restored

### Docker Restore Example

```bash
# Stop the container
docker stop tunarr

# Extract backup to a temporary location
tar -xzvf tunarr-backup-20250118_040000.tar.gz -C /tmp/tunarr-restore/

# Copy to your mounted volume
cp /tmp/tunarr-restore/db.db /path/to/tunarr/data/
cp /tmp/tunarr-restore/settings.json /path/to/tunarr/data/

# Start the container
docker start tunarr
```

## Excluding Search Snapshots

Meilisearch index snapshots can be large. To exclude them from backups, set the environment variable:

```bash
TUNARR_DISABLE_SEARCH_SNAPSHOT_IN_BACKUP=true
```

When restoring a backup without search snapshots, Tunarr will automatically rebuild the search index on startup. This may take a few minutes depending on your library size.

!!! warning "Windows Snapshots"
    There is currently an [issue in Meilisearch](https://github.com/meilisearch/meilisearch/issues/6051) where snapshots do not work correctly on Windows. Until this is resolved, Windows users should disable Meilisearch snapshots.

## Backup Storage Locations

### Default Location

Backups are stored in the `backups/` subdirectory of your Tunarr data directory:

| Platform | Default Path |
|----------|--------------|
| Docker | `/config/tunarr/backups/` |
| Windows | `%APPDATA%\tunarr\backups\` |
| macOS | `~/Library/Preferences/tunarr/backups/` |
| Linux | `~/.local/share/tunarr/backups/` |

### Custom Location

You can configure a custom output path in the backup settings to store backups on a different drive or network location.

## Best Practices

1. **Test your backups** - Periodically verify that backups can be restored successfully
2. **Store backups off-site** - Copy backups to cloud storage or another machine
3. **Monitor disk space** - Ensure your backup location has sufficient free space
4. **Adjust retention** - Increase `maxBackups` if you need more recovery points
5. **Schedule during off-hours** - Run backups when Tunarr is less active to minimize impact