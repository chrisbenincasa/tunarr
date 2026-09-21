# ErsatzTV next backend

Tunarr can hand a channel to `ersatztv-channel`, a standalone worker from the [ErsatzTV next](https://ersatztv.org/) project that transcodes and segments the channel itself instead of Tunarr running its own FFmpeg pipeline.

!!! warning "Experimental"

    Upstream publishes no tagged release, so Tunarr builds against a pinned commit. A worker built from a different commit still runs, but Tunarr logs a warning and streams may fail in ways its schema checks cannot catch.

This page covers how your FFmpeg and transcode settings reach the worker. For what the backend is and how it plays a channel, see [Channel Transcoding Settings](../channels/transcoding.md#ersatztv-next-backend-experimental).

## Turning it on

Set `TUNARR_ERSATZTV_NEXT_ENABLED=true` (see [Environment Variables](../../getting-started/run.md#transcoding)). Every channel set to **HLS**, **HLS Direct v2** or **MPEG-TS** is then served by the worker. HLS alt and HLS Direct keep using Tunarr's pipeline.

Nothing about a channel changes. The stream mode you picked still means what it did, and you do not assign the backend per channel.

## How settings are translated

When a channel starts, Tunarr writes a `channel.json` for the worker, built from the channel's [transcode config](transcode_config.md) and the global FFmpeg settings on this page. The worker's configuration does not cover everything a transcode config can express, so a setting either translates, is refused, or is dropped.

### Refused settings

A transcode config with any of these cannot back a channel on this backend. The channel fails to start rather than streaming with a substitution you did not ask for.

| Setting | Accepted values |
| ------- | --------------- |
| Video format | `h264`, `hevc` |
| Audio format | `aac`, `ac3` |
| Hardware acceleration | `none`, `cuda`, `qsv`, `vaapi`, `videotoolbox` |

The transcode config editor warns about these while the backend is enabled, so you can find an offending config before a viewer does.

### Dropped settings

These translate to nothing on the worker. The channel streams; it streams without them.

| Setting | What happens |
| ------- | ------------ |
| Thread count | The worker chooses its own. |
| Video preset and profile | The worker exposes neither yet. |
| Audio volume | The worker has no volume filter. |
| Normalize frame rate | The worker does not normalize frame rate. |
| Scaling algorithm | The worker hardcodes `fast_bilinear` for software scaling. |
| VAAPI driver `nouveau` | It has no counterpart. `i965`, `ihd` and `radeonsi` translate. |

Tunarr logs the dropped settings once when a channel starts, and the transcode config editor lists them.

### VAAPI needs a named driver

The worker accelerates only when its config names both a render node and a VAAPI
driver, and it falls back to software encoding when either is missing
([ErsatzTV/next#246](https://github.com/ErsatzTV/next/issues/246)). Tunarr's own
pipeline instead lets libva choose, which is what the `system` driver setting
means, so that setting has nothing to translate to.

Rather than let a hardware channel quietly become a software one, Tunarr fills
both in:

- **Device.** An unset VAAPI device becomes `/dev/dri/renderD128` on Linux, the
  same default the built-in pipeline uses.
- **Driver.** A driver of `system` is resolved by reading the render node's PCI
  vendor id from `/sys/class/drm/<node>/device/vendor` — Intel becomes `ihd` and
  AMD becomes `radeonsi`.

Set the driver explicitly if the guess is wrong for your hardware; an explicit
choice is always passed through untouched. On an NVIDIA card, or where the
vendor cannot be read, no driver is sent, and the transcode config editor says
the channel will transcode in software.

## Known gaps

- **Audio and subtitle track selection does not reach the worker.** The playout contract carries no track indices, so a channel on this backend plays the file's default tracks regardless of the stream selection profile that would otherwise apply.
- **Watermarks and channel overlays are not applied.** The worker draws neither.
- **Programming edits land within half an hour.** The schedule is materialized ahead of playback, so an edit takes effect at the first program boundary after the next rebuild.

## Troubleshooting a channel

The [Stream Troubleshooter](../../misc/troubleshooting.md) runs the same diagnostic transcode it always has, but for a channel on this backend it runs through the worker rather than through Tunarr's pipeline, so the report describes what actually plays.

Three things read differently than they do for a Tunarr-pipeline channel:

- **The FFmpeg command** is the one the worker resolved, not one Tunarr built.
- **The FFmpeg log** comes from the dossier the worker leaves behind, which also holds the pipeline, media info and playout item it resolved.
- **No stream selection trace is produced**, because track selection does not reach the worker.

Any refused or dropped setting is listed with the errors, so a report from a channel that streams differently than its config reads says why.

Media server tokens are stripped from the command, the log and the report, so a troubleshoot report is safe to attach to a bug report.
