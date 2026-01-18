# Logging

Tunarr provides configurable logging to help you monitor server activity and troubleshoot issues. Logs can be viewed in the console, written to files, and accessed via the web UI or API.

## Log Levels

Tunarr supports the following log levels, from least to most verbose:

| Level | Description |
|-------|-------------|
| `silent` | No logging output |
| `fatal` | Critical errors that cause the application to stop |
| `error` | Error conditions that should be investigated |
| `warn` | Warning conditions that may indicate problems |
| `info` | General operational information (default) |
| `debug` | Detailed information useful for debugging |
| `trace` | Very detailed trace information |

Additionally, Tunarr has custom levels for HTTP traffic:

| Level | Value | Description |
|-------|-------|-------------|
| `http` | 25 | Incoming HTTP request logging |
| `http_out` | 15 | Outgoing HTTP request logging (to Plex, Jellyfin, etc.) |

## Configuration

### Via Environment Variables

The simplest way to configure logging is through environment variables:

```bash
# Set log level (overrides UI setting)
LOG_LEVEL=debug

# Set custom log directory
LOG_DIRECTORY=/path/to/logs
```

### Via Web UI

Navigate to **Settings > System > Logging** to configure:

- Log level
- Log file directory
- Log rolling settings

### Via API

Update logging settings through the system settings API:

```bash
curl -X PUT "http://localhost:8000/api/system/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "logging": {
      "logLevel": "debug",
      "useEnvVarLevel": false,
      "logRollConfig": {
        "enabled": true,
        "maxFileSizeBytes": 10485760,
        "rolledFileLimit": 5
      }
    }
  }'
```

## Log Files

### Location

Log files are stored in the `logs/` subdirectory of your Tunarr data directory:

| Platform | Default Path |
|----------|--------------|
| Docker | `/config/tunarr/logs/` |
| Windows | `%APPDATA%\tunarr\logs\` |
| macOS | `~/Library/Preferences/tunarr/logs/` |
| Linux | `~/.local/share/tunarr/logs/` |

### File Format

- **Main log file**: `tunarr.log`
- **Format**: NDJSON (newline-delimited JSON)

Each log entry contains:

```json
{"level":30,"time":1705574400000,"msg":"Server started","hostname":"tunarr","pid":1234}
```

## Log Rolling

Log rolling prevents log files from growing indefinitely by rotating them when they reach a certain size or on a schedule.

### Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| **Enabled** | `false` | Enable log file rotation |
| **Max File Size** | `1 MB` | Rotate when file exceeds this size |
| **Rolled File Limit** | `3` | Number of rotated files to keep |
| **Schedule** | (none) | Optional time-based rotation |

### Rotated File Naming

When rotation occurs:

1. `tunarr.log` is copied to `tunarr.log.1`
2. Existing numbered files shift up (`tunarr.log.1` → `tunarr.log.2`)
3. Files exceeding the limit are deleted
4. `tunarr.log` is truncated and continues receiving new entries

Example with `rolledFileLimit: 3`:

```
tunarr.log      (current, active)
tunarr.log.1    (previous rotation)
tunarr.log.2    (older)
tunarr.log.3    (oldest, will be deleted on next rotation)
```

### Enabling Log Rolling

```bash
curl -X PUT "http://localhost:8000/api/system/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "logging": {
      "logRollConfig": {
        "enabled": true,
        "maxFileSizeBytes": 10485760,
        "rolledFileLimit": 5
      }
    }
  }'
```

## Viewing Logs

### Via Web UI

Access logs in the Tunarr web interface under **Settings > System > Logs**.

### Via API

#### Stream Live Logs

Stream logs in real-time using Server-Sent Events:

```bash
# Raw NDJSON format
curl "http://localhost:8000/api/system/debug/logs/stream"

# Pretty-printed format
curl "http://localhost:8000/api/system/debug/logs/stream?pretty=true"
```

#### Download Logs

Download the log file:

```bash
# Download entire log file
curl "http://localhost:8000/api/system/debug/logs?download=true" -o tunarr.log

# Download last 1000 lines
curl "http://localhost:8000/api/system/debug/logs?download=true&lineLimit=1000" -o tunarr.log

# Download pretty-printed
curl "http://localhost:8000/api/system/debug/logs?download=true&pretty=true" -o tunarr.log
```

### Via Command Line

```bash
# Follow logs in real-time (Docker)
docker logs -f tunarr

# View log file directly
tail -f /path/to/tunarr/data/logs/tunarr.log

# Pretty-print JSON logs with jq
tail -f /path/to/tunarr/data/logs/tunarr.log | jq '.'
```

## Troubleshooting with Logs

### Recommended Log Levels

| Scenario | Recommended Level |
|----------|-------------------|
| Normal operation | `info` |
| Investigating issues | `debug` |
| Detailed troubleshooting | `trace` |
| Minimal logging | `warn` |
| Performance testing | `error` or `silent` |

### Common Log Patterns

**Startup messages**:
```
Server started on port 8000
Meilisearch started on port 7700
Loading channels...
```

**Media source sync**:
```
Syncing Plex library: Movies
Found 500 items in library
Sync completed in 5.2s
```

**Streaming issues**:
```
FFmpeg process started for channel 1
Stream error: Connection reset by peer
FFmpeg process exited with code 1
```

**Search indexing**:
```
Indexing 1000 programs...
Index update completed
```

### Increasing Verbosity Temporarily

To temporarily increase log verbosity for debugging:

1. Set `LOG_LEVEL=debug` environment variable
2. Restart Tunarr
3. Reproduce the issue
4. Check logs for detailed information
5. Reset log level when done

For Docker:

```bash
docker run -e LOG_LEVEL=debug ... chrisbenincasa/tunarr
```

## Performance Considerations

- **Higher log levels** (`debug`, `trace`) generate more output and may impact performance
- **Log rolling** helps manage disk space but adds slight overhead during rotation
- **Streaming logs** via API maintains an open connection; close when not needed
- Consider using `info` level for production and `debug` only when troubleshooting

## Log Output Destinations

Tunarr outputs logs to multiple destinations:

| Destination | Format | Description |
|-------------|--------|-------------|
| Console (stdout) | Pretty-printed | Colored, human-readable output |
| Log file | NDJSON | Machine-parseable JSON format |

Console output includes:

- Colored log levels
- Timestamps
- Source file information (in development mode)
- Formatted messages

Example console output:

```
[INFO] 2025-01-18T04:00:00.000Z [ChannelService] Channel 1 started streaming
[DEBUG] 2025-01-18T04:00:01.000Z [FFmpegService] FFmpeg args: -i input.ts -c copy output.ts
[ERROR] 2025-01-18T04:00:02.000Z [StreamService] Stream failed: connection timeout
```
