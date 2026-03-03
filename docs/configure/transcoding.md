# Transcoding

Tunarr uses FFmpeg to transcode or remux content when generating channel streams. Transcoding settings are split across two levels: channel-level settings that control the streaming architecture, and transcode configuration settings that control codec, resolution, bitrate, and hardware acceleration.

## Channel Stream Mode

The **stream mode** determines the overall pipeline architecture Tunarr uses to produce a channel's output. Available modes include HLS (recommended), HLS alt, HLS Direct, and MPEG-TS. Each mode has different characteristics in terms of reliability, CPU usage, and client compatibility.

See [Channel Transcoding Settings](channels/transcoding.md) for a full explanation of each mode and guidance on choosing one.

## Transcode Configurations

A **transcode configuration** is a reusable set of encoding parameters (codec, resolution, bitrate, hardware acceleration, audio settings, etc.) that can be assigned to one or more channels. This is where you configure *how* Tunarr encodes the output stream.

See [Transcode Configs](ffmpeg/transcode_config.md) for a detailed breakdown of every setting, including hardware acceleration options for NVIDIA, Intel, AMD, and macOS.
