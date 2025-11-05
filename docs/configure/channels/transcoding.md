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

### MPEG-TS

This mode is the closest to the DizqueTV experience.

#### How does it work?

It consists of two FFMPEG processes, one which performs the per-program transcode, outputting an mpeg-ts stream and one which concatenates this raw stream together and outputs it.

#### Things to consider

If this mode was "good enough" we probably wouldn't have spent time implementing the other modes! There are a lot of potential issues with this mode; too many to list here.
