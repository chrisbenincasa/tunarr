# FFmpeg

Tunarr requires FFmpeg for transcoding / remuxing content when outputting channel streams. Settings relating to transcoding and FFmpeg can be found on the Settings > FFmpeg page.

## Executable Paths

!!! info
    Only non-Docker installs must provide FFmpeg executable paths. Docker installs come with a bundled version of FFmpeg.

Configure FFmpeg and FFprobe executable paths. Generally, both executables reside in the same directory. We recommend using a [specially built FFmpeg 7.1.1](https://github.com/ErsatzTV/ErsatzTV-ffmpeg/releases/tag/7.1.1) provided by ErsatzTV.

## Global FFmpeg options

### Logging

!!! warn
    It is recommended to only enable this setting while debugging. If Tunarr experiences an FFmpeg error, it will _still_ generate an error log file that can be used when troubleshooting issues.

Printing or persisting FFmpeg logs to disk is useful when debugging streaming issues. This setting allows for FFmpeg logging to be outputted to Tunarr's stdout stream or to a separate file with a configurable log level. 

### HLS Direct Output Format

When using the HLS Direct stream mode in a channel (see [channel stream modes](../channels/transcoding/#hls-direct)), use this setting to change the output container format for the stream.

### FFmpeg Transcode Path

Configure the path where FFmpeg writes HLS segments for a channel's stream. For instance, if running the standalone Linux binary, Tunarr can write transcoded segments to RAM by setting this option to `/dev/shm`. 

#### Transcode to RAM in Docker

Transcoding to RAM when running Tunarr in Docker requires configuring the container to create a `tmpfs` at startup time:

```yaml title="docker-compose.yml"
# ... rest of your docker compose
services:
    tunarr:
    # ... rest of your Tunarr service
    tmpfs:
        - /transcode:size=10G
```

Then, in Tunarr, you would set your transcode path to `/transcode`.

## Audio & Subtitles

### Subtitle Extraction

If content in your channels have embedded, text-based subtitles, this option enables Tunarr to extract subtitles from media files in order to subsequently burn the subtitles. Extract embedded text-based subtitles is currently a requirement for using said subtitle streams. Each hour Tunarr will scan the guide for upcoming media, find which items have embedded text-based subtitles, and then run extraction. This can be a resource-intensive process, so in general, sidecar text-based subtitles are preferable.

### Sidecar Subtitles

Tunarr supports sidecar subtitle files (`.srt`, `.vtt`, etc.) placed alongside your media files. When scanning local libraries, Tunarr automatically discovers external subtitle files and associates them with the corresponding media.

For Plex, Jellyfin, and Emby sources, external subtitles are always resolved to a local file during scanning, so that starting a stream never waits on the media server:

1. **Shared storage.** If the subtitle file the media server reported is visible to Tunarr — directly, or through the source's [path replacements](../media_sources/jellyfin.md#configuring-path-replacements) — it is used as-is. Nothing is copied.
2. **Downloaded during scanning.** Otherwise Tunarr fetches the subtitle from the media server and caches it locally.

Setting up path replacements for a media source therefore benefits subtitles as well as video, and is the only way image-based external subtitles can be used, since those cannot be downloaded as text.

A subtitle that could not be resolved during a scan — because the media server was unreachable, for example — is retried hourly for programs airing in the next hour on channels that have subtitles enabled, so it becomes available without waiting for a rescan of the whole library. The same pass restores a cached subtitle file that has since been deleted.

!!! note
    External subtitles from Jellyfin and Emby libraries scanned by an older version of Tunarr are picked up by that hourly pass once the program is scheduled, or immediately on the next rescan of the library.

When using the **HLS Direct** stream mode, sidecar text-based subtitles are served as WebVTT tracks in the HLS master playlist. Clients that support HLS subtitle renditions (most modern players) will display them as selectable subtitle options.

!!! note
    Sidecar subtitle support is currently experimental. To enable it, go to **Settings > Features** and turn on the sidecar subtitles option.

### Language Preference

Currently, language preferences can only be configured globally. Use this setting to set an ordered list of preferred audio languages. The first matching audio language stream for a given piece of content will be chosen.