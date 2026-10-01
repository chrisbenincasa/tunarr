# ErsatzTV next backend

Tunarr can hand a channel to `ersatztv-channel`, a standalone worker from the [ErsatzTV next](https://ersatztv.org/) project that transcodes and segments the channel itself instead of Tunarr running its own FFmpeg pipeline.

!!! warning "Experimental"

    Upstream publishes no tagged release, so Tunarr builds against a pinned commit. A worker built from a different commit still runs, but Tunarr logs a warning and streams may fail in ways its schema checks cannot catch.

This page covers how your FFmpeg and transcode settings reach the worker. For what the backend is and how it plays a channel, see [Channel Transcoding Settings](../channels/transcoding.md#ersatztv-next-backend-experimental).

## Turning it on

There are two ways in, meant to be used in that order.

**One channel at a time.** Open a channel, go to the **Streaming** tab, and tick **Use ErsatzTV next Backend**. Only that channel moves to the worker; everything else keeps using Tunarr's pipeline. Use this to try the backend on a channel you do not mind breaking before you commit the rest.

**All channels at once.** Set `TUNARR_ERSATZTV_NEXT_ENABLED=true` (see [Environment Variables](../../getting-started/run.md#transcoding)), or turn on **ErsatzTV next Streaming Backend** under Settings → Features. Every eligible channel is then served by the worker whether or not it was ticked individually, so the per-channel box disappears from the editor while this is on. Switching it back off returns each channel to whatever its own box says.

Either way, only channels set to **HLS**, **HLS Direct v2** or **MPEG-TS** are eligible. The worker only writes HLS, and HLS Direct remuxes without transcoding, which it cannot do, so HLS alt and HLS Direct always stay on Tunarr's pipeline. The per-channel box is disabled on those two modes.

Nothing else about a channel changes. The stream mode you picked still means what it did.

## How settings are translated

When a channel starts, Tunarr writes a `channel.json` for the worker, built from the channel's [transcode config](transcode_config.md) and the global FFmpeg settings on this page. The worker's configuration does not cover everything a transcode config can express, so a setting either translates, is refused, or is dropped.

### Refused settings

A transcode config with any of these cannot back a channel on this backend. The channel fails to start rather than streaming with a substitution you did not ask for.

| Setting | Accepted values |
| ------- | --------------- |
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

### VAAPI defaults

An unset VAAPI device and a driver of `system` are left for the worker to fill
in. It uses `/dev/dri/renderD128`, the same default the built-in pipeline uses,
and lets libva choose the driver. An explicit device or driver is passed
through untouched.

## Known gaps

The first two gaps are in Tunarr's side of the integration, not in ErsatzTV next. The worker supports both features, and Tunarr does not send them yet.

- **Stream selection profiles are not applied.** Tunarr does not yet tell the worker which audio or subtitle track to use. The worker plays the first audio track in the file, whatever the channel's stream selection profile says.
- **Watermarks and channel overlays are not applied.** Tunarr does not yet send the watermark to the worker, so none is drawn.
- **Programming edits land at the next item, not immediately.** The worker asks Tunarr what to play one item at a time, and it transcodes up to 44 seconds ahead of what viewers see. An edit takes effect the next time the worker asks. Anything already transcoded plays as it was.

## Troubleshooting a channel

The [Stream Troubleshooter](../../misc/troubleshooting.md) runs the same diagnostic transcode it always has, but for a channel on this backend it runs through the worker rather than through Tunarr's pipeline, so the report describes what actually plays.

Three things read differently than they do for a Tunarr-pipeline channel:

- **The FFmpeg command** is the one the worker resolved, not one Tunarr built.
- **The FFmpeg log** comes from the dossier the worker leaves behind, which also holds the pipeline, media info and playout item it resolved.
- **No stream selection trace is produced**, because Tunarr does not yet apply stream selection on this backend.

Any refused or dropped setting is listed with the errors, so a report from a channel that streams differently than its config reads says why.

Media server tokens are stripped from the command, the log and the report, so a troubleshoot report is safe to attach to a bug report.

## Diagnostic bundles

Every time the worker cannot play an item it writes a bundle to `etv-diagnostics/<channel id>/` under Tunarr's data directory. Each one holds the FFmpeg report or its stderr tail, the resolved pipeline and hardware acceleration, the playout item, the probe output, the merged channel config the worker actually ran with, and the outcome.

This is on and needs no setting. A channel keeps its five most recent bundles; older ones are removed when the channel next starts. Turning off file logging does not turn it off, because the bundle is what a bug report needs and asking for it after the fact means asking someone to reproduce a failure they have already had.

The [Stream Troubleshooter](../../misc/troubleshooting.md) offers **Download Backend Diagnostics** for a channel that has any, which hands back all five as one zip.
