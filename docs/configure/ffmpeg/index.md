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

### Language Preference

Currently, language preferences can only be configured globally. Use this setting to set an ordered list of preferred audio languages. The first matching audio language stream for a given piece of content will be chosen.