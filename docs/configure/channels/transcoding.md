# Channel Trancoding Settings

## Stream Mode

Tunarr supports several different stream modes that can be set at the channel level.

!!! info

    No matter which stream mode you choose for a channel, clients which require an MPEG-TS stream will still work.

### HLS (recommended)

HLS is the default streaming mode for a channel. In our testing, it is generally the most reliable and efficient. It is akin to [ErsatzTV's](https://ersatztv.org/) "HLS Segmenter" mode.

#### How does it work?

This mode creates a single FFMPEG process, per-program. The process applies all transcoding configuration necessary. Tunarr manages interleaving these processes to create seamless m3u8 playlists for playback.

#### Things to consider

In our testing, we've found this mode to be both efficient and reliable. That said, it is also the newest mode introduced to Tunarr, so there might be some kinks to work out.

### HLS alt

HLS alt (name pending!) is another HLS streaming mode, which operates a little differently. This mode is akin to [ErsatzTV's](https://ersatztv.org/) "HLS Segmenter V2" mode.

#### How does it work?

This mode creates two FFMPEG processes. The first runs per-program and applies scaling/cropping, watermarks, frame rate changes, etc, but outputs a rawvideo stream. The second process concatenates all of these together while also applying bit rate limits and codec changes.

#### Things to consider

The downside to this mode is that the one of the steps (the per-program process) _requires_ software encoding. This can put a lot of stress on certain systems. The stream setup can also lead to quality loss, due to generation loss. However, it does have the potential to create a more reliable / robust stream.

### HLS Direct

#### How does it work?

This mode does not perform any stream normalization. When the channel m3u8 playlist is requested, it returns a playlist with a single item URL set to the duration of the current item in the channel. The URL returns a direct stream of the item, remuxed to the container configured in the ffmpeg settings (MPEG-TS, MKV, or MP4).

#### Things to consider

Because this mode does not perform stream normalization, there may be issues when transitioning between programs; the mode requires clients to essentially "reset" themselves between each program for transitions to function as expected. Some clients that are known to work in this mode are Jellyfin and MPV, but there are almost certainly others.

### HLS Direct v2

#### How does it work?

HLS Direct v2 works like standard HLS mode, but without transcoding. Rather than returning a single-item m3u8 pointing directly to the program stream (as HLS Direct does), it produces a proper continuous HLS playlist of segmented chunks — the same structure as the regular HLS mode. No codec conversion or normalization is applied; the source content is remuxed directly into the segments.

#### Things to consider

Users who want direct streaming without transcoding may find this mode more compatible than HLS Direct, particularly with clients that do not rely on FFmpeg's HLS demuxer implementation. Because the output is a standard segmented HLS playlist, clients that expect that structure should handle program transitions more gracefully than they would with HLS Direct.

As with HLS Direct, no stream normalization is applied, so mixed source formats (different codecs, resolutions, frame rates) across lineup items may cause playback issues depending on the client.

### MPEG-TS

This mode is the closest to the DizqueTV experience.

#### How does it work?

It consists of two FFMPEG processes, one which performs the per-program transcode, outputting an mpeg-ts stream and one which concatenates this raw stream together and outputs it.

#### Things to consider

If this mode was "good enough" we probably wouldn't have spent time implementing the other modes! There are a lot of potential issues with this mode; too many to list here.

## ErsatzTV next backend (experimental)

The modes above all run Tunarr's own FFmpeg pipeline. Tunarr can instead hand a channel to `ersatztv-channel`, a standalone worker from the [ErsatzTV next](https://ersatztv.org/) project that does the scheduling, transcoding and segmenting itself.

!!! warning "Experimental"

    Upstream publishes no tagged release, so Tunarr builds against a pinned commit. A worker built from a different commit still runs, but Tunarr logs a warning and streams may fail in ways its schema checks cannot catch.

Set `TUNARR_ERSATZTV_NEXT_ENABLED=true` to turn it on (see [Environment Variables](../../getting-started/run.md#transcoding)). It replaces the pipeline for channels set to **HLS**, **HLS Direct v2** and **MPEG-TS**. HLS alt and HLS Direct keep using Tunarr's pipeline. Channel settings do not change, and the mode you pick in the UI still means what it did.

MPEG-TS clients still get MPEG-TS. Tunarr concatenates the worker's HLS output rather than running its own per-program transcode.

### How does it work?

Tunarr runs one worker per channel being watched, and gives each a directory under the transcode directory:

| Path | Contents |
| ---- | -------- |
| `channel.json` | Transcode settings, translated from the channel's transcode config and the global FFmpeg settings. |
| `playout/<start>_<finish>.json` | The schedule the worker plays, materialized two hours ahead and rebuilt on a timer while the channel is watched. |
| `out/` | The worker's HLS playlist and segments, plus the `.ready` and `.heartbeat` files it signals with. |

Tunarr synthesizes the multivariant playlist clients are handed and serves the worker's segments. No ErsatzTV server is involved. Tunarr spawns the worker, feeds its heartbeat file while viewers are connected, and kills it when the last one leaves.

### Things to consider

- **The binary has to be findable.** The Docker images ship it. Elsewhere, put `ersatztv-channel` in `bin/` next to the Tunarr server or in the working directory, or point `TUNARR_ERSATZTV_NEXT_PATH` at the binary or the directory holding it. Tunarr does not search `PATH`.
- **Programming edits land within half an hour.** The schedule is materialized ahead of playback rather than chosen program by program, so an edit does not reach a running stream immediately. Tunarr rebuilds the unplayed part of the window on a timer and leaves the program currently airing alone, so an edit takes effect at the first program boundary after the next rebuild.
- **Some settings do not survive the translation.** The worker's configuration does not cover everything a Tunarr transcode config can express. Some settings stop a channel from starting and others are simply dropped. See [ErsatzTV next backend](../ffmpeg/ersatztv-next.md) for which are which.
- **A dead worker ends the session.** If the worker exits on its own, Tunarr tears the session down rather than serving a playlist that has stopped advancing. The next viewer starts a fresh worker.
