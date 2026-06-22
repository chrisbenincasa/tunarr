# Stream Troubleshooter

The Stream Troubleshooter helps diagnose playback issues for individual programs. It runs a full diagnostic session that exercises the same code path as real streaming — from media source connectivity through stream selection, pipeline construction, and a short test transcode.

## Accessing the Troubleshooter

There are two ways to open the troubleshooter:

1. **System navigation**: Go to **System > Troubleshoot** in the top-level tabs.
2. **Program context menu**: Load program details for any program in your library or channel programming, then select **Troubleshoot**. This pre-fills the program selection for you.

## Running a Troubleshoot Session

### Step 1: Select a Program

Use the search box to find the program you're having trouble with. Only playable media items (movies, episodes, tracks) can be troubleshot — folders and collections cannot.

If you navigated here from a program's context menu, the program is already selected.

### Step 2: Select a Channel

Choose the channel where you're experiencing the issue. The channel determines which transcode configuration and stream selection profile are used during the test.

### Step 3: (Optional) Override Transcode Config

By default, the troubleshooter uses the transcode config assigned to the selected channel. If you want to test with a different configuration — for example, to see if a problem is specific to hardware acceleration settings — select an override from the dropdown.

### Step 4: Set Test Duration

Choose how long (in seconds) the test transcode should run. The default is **30 seconds**. The minimum is 5 seconds and the maximum is 120 seconds. Longer tests are more thorough but take more time.

### Step 5: Run

Click **Run Troubleshooter**. The tool will:

1. Gather system information (Tunarr version, FFmpeg version, platform, available hardware accelerators).
2. Fetch media stream details from your media source (Plex, Jellyfin, Emby, or local files).
3. Evaluate stream selection rules to determine which audio and subtitle streams are chosen.
4. Build the FFmpeg transcoding pipeline — the exact same pipeline used during real playback.
5. Execute a short test transcode using a random segment of the media file.
6. If the transcode succeeds, play back the result in the browser as a preview.

## Understanding the Results

After the troubleshooter finishes, the results are displayed in expandable sections:

### Errors

If anything went wrong, errors appear in a red banner at the top. Common errors include:

- **Program not found** — The program was deleted or its ID is invalid.
- **Media source not found** — The media server associated with this program is no longer configured.
- **Failed to get stream details** — Tunarr couldn't reach the media server or the file is missing/inaccessible.
- **Failed to create FFmpeg stream session** — The pipeline couldn't be built (e.g., missing codec support).

### System Info

Shows the versions and capabilities of your environment:

| Field | Description |
|-------|-------------|
| Tunarr | The running Tunarr version |
| FFmpeg | The detected FFmpeg version string |
| Node.js | The Node.js runtime version |
| Platform | Operating system and kernel version |
| HW Acceleration | Hardware acceleration methods available to FFmpeg (e.g., `cuda`, `vaapi`, `videotoolbox`) |

### Media Info

Details about the program and its streams as reported by the media source:

- **Program metadata**: title, type, duration, source type (Plex/Jellyfin/Emby/local), and the stream path (with authentication tokens redacted).
- **Video streams**: codec, resolution, frame rate, pixel format, bit depth, and color information.
- **Audio streams**: codec, language, channel count, title, and whether the stream is marked as default.
- **Subtitle streams**: codec, language, type (text/image-based), and default/forced/SDH flags.

### Stream Selection

Shows which stream selection profile was applied and the result of evaluating each rule:

- Rules that **matched** are highlighted in green.
- The first matched rule determines the selected audio and subtitle streams.
- If no rule matched, the first audio stream is selected and subtitles are disabled.
- The **Selected Audio** and **Selected Subtitle** chips show exactly which streams will be used during transcoding.

### Transcode Config

Displays the transcode configuration used for the test, including video format, resolution, audio format, and hardware acceleration mode.

### Pipeline

The constructed FFmpeg pipeline:

- **Builder type** and hardware acceleration mode.
- **FFmpeg Command**: The full FFmpeg argument string that was (or would be) executed. Authentication tokens in URLs are redacted.

### Test Transcode

Shows whether the short test transcode succeeded or failed:

- **Success**: A green chip and a video player showing the transcoded output.
- **Failed**: A red chip with the exit code. Check the FFmpeg Log section for details.

### FFmpeg Log

The full FFmpeg report log from the test transcode. This contains detailed information about codec initialization, filter graph construction, encoding performance, and any warnings or errors FFmpeg encountered.

## Producing a Troubleshoot Report for Bug Reports

When reporting a streaming issue, include the troubleshooter output so the developer can reproduce and diagnose the problem. Follow these steps:

### Step-by-Step

1. Navigate to **System > Troubleshoot**.
2. Search for and select the **exact program** that's causing issues.
3. Select the **exact channel** where you observe the problem.
4. If you're using a non-default transcode config, select it in the override dropdown.
5. Set the test duration to **30 seconds** (the default is fine for most reports).
6. Click **Run Troubleshooter** and wait for it to complete.
7. Once results appear, click **Download JSON** to save the report as a file.
    - Alternatively, click **Copy Full Report** to copy the JSON to your clipboard.
8. Attach the downloaded `.json` file to your bug report (GitHub issue or Discord message).

!!! tip
    The JSON report contains all the information needed for debugging: system versions, media stream details, the full FFmpeg command line, stream selection rule traces, and the FFmpeg log output. Sensitive information (API tokens for Plex, Jellyfin, and Emby) is automatically redacted.

!!! note
    The test transcode output (HLS segments) is only kept for 5 minutes after the troubleshoot session completes. The downloaded JSON report is permanent and contains all the diagnostic information — the video preview is just for your own verification.

### What's Included in the Report

The downloaded JSON file contains:

```json
{
  "systemInfo": { "tunarrVersion": "...", "ffmpegVersion": "...", ... },
  "mediaInfo": { "title": "...", "videoStreams": [...], "audioStreams": [...], ... },
  "streamSelection": { "profileName": "...", "rules": [...], ... },
  "transcodeConfig": { "name": "...", "videoFormat": "...", ... },
  "channelConfig": { ... },
  "pipeline": { "ffmpegArgs": [...], "ffmpegArgsString": "...", ... },
  "testTranscode": { "exitCode": 0, "success": true, ... },
  "ffmpegLog": "...",
  "errors": [],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Changing the Log Level for Debugging

When investigating streaming issues, the default `info` log level may not capture enough detail. Switching to `debug` or `trace` produces much more verbose output that can reveal exactly where a problem occurs.

There are three ways to change the log level:

### Via the Web UI

1. Go to **Settings > System**.
2. Under **Logging**, change the **Log Level** dropdown to `debug` (or `trace` for maximum detail).
3. Click **Save**.
4. The change takes effect immediately — no restart needed.

!!! tip
    You can also set **per-category** log levels to avoid flooding the logs. For streaming issues, set the **streaming** category to `debug` while leaving the global level at `info`. This gives you detailed stream/transcode logs without noise from other subsystems.

### Via Environment Variable

Set the `LOG_LEVEL` environment variable before starting Tunarr:

```bash
# Standalone
LOG_LEVEL=debug node server.js

# Docker
docker run -e LOG_LEVEL=debug ... chrisbenincasa/tunarr

# Docker Compose
environment:
  - LOG_LEVEL=debug
```

!!! note
    When `LOG_LEVEL` is set via environment variable, it overrides the UI setting. Remove the variable and restart to go back to using the UI-configured level.

### Via the API

```bash
curl -X PUT "http://localhost:8000/api/system/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "logging": {
      "logLevel": "debug"
    }
  }'
```

To set only the streaming category to debug:

```bash
curl -X PUT "http://localhost:8000/api/system/settings" \
  -H "Content-Type: application/json" \
  -d '{
    "logging": {
      "logLevel": "info",
      "categoryLogLevel": {
        "streaming": "debug"
      }
    }
  }'
```

### Collecting Logs for a Bug Report

1. Set the log level to `debug` (using any method above).
2. Reproduce the issue (e.g., play the channel that's failing).
3. Collect the logs:
      - **Web UI**: Go to **System > Logs** and copy the relevant output.
      - **Log file**: Find `tunarr.log` in your data directory's `logs/` folder (see [Logging](../configure/system/logging.md#location) for the path on your platform).
      - **Docker**: Run `docker logs tunarr 2>&1 | tail -500 > tunarr-debug.log`.
4. Set the log level back to `info` when you're done.
5. Attach the log output to your bug report alongside the troubleshooter JSON.

For full details on log configuration, file locations, and log rolling, see the [Logging](../configure/system/logging.md) documentation.

### What's NOT Included (Privacy)

- Plex tokens (`X-Plex-Token`) are replaced with `REDACTED`.
- Emby/Jellyfin API keys (`X-Emby-Token`, `api_key`) are replaced with `REDACTED`.
- No personal account information is included.
- File paths on your media server are visible (e.g., `/media/movies/...`) — redact these manually if needed before sharing publicly.
