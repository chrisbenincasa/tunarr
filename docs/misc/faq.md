# Frequently Asked Questions

## Why does Tunarr transcode all content instead of passing it through directly?

Tunarr always re-encodes content through FFmpeg rather than streaming source files directly to clients. This is a hard technical requirement imposed by the nature of a continuous IPTV stream assembled from independently-encoded media files.

### Independently-encoded files are incompatible

Tunarr must assume that every file in a user's media library was encoded in isolation with no relationship to any other file. Resolution, codec, frame rate, bitrate, audio channels, and dozens of other encoding parameters may all differ from one file to the next. When Tunarr stitches these files into a single uninterrupted channel stream, every one of those differences becomes a potential failure point at each program boundary.

Transcoding all content to a common set of parameters is what makes seamless transitions possible. Without normalization, the stream would break — or appear to break to the client — at almost every program change.

### Stream properties that must match across program boundaries

| Property | Example variation | What breaks without normalization |
|---|---|---|
| Video codec | H.264, HEVC, MPEG-2, AV1 | A video decoder is initialized for one codec and cannot switch mid-stream. Most clients (especially hardware decoders) will stall, flash a black frame, or disconnect entirely. |
| Resolution | 480p, 720p, 1080p, 4K | The decoder pre-allocates buffers sized for a specific resolution. A resolution change mid-stream causes a hard decoder error on most hardware decoders. |
| Frame rate | 23.976, 25, 29.97, 60 fps | Frame rate determines the relationship between encoded timestamps and wall-clock time. A mismatch causes dropped or duplicated frames at the boundary and progressive audio/video desynchronization. |
| Audio codec | AAC, AC-3 (Dolby), DTS | The audio renderer must completely reinitialize when the codec changes, causing a gap or burst of silence at the transition. |
| Audio sample rate | 44.1 kHz, 48 kHz | The audio clock runs at a different speed, causing drift relative to the video clock that compounds over time into audible out-of-sync audio. |
| Scan type | Interlaced (broadcast), Progressive (modern) | Interlaced fields are interpreted as full frames, causing combing artifacts and incorrect cadence. |

### Internal Timestamps

Each media file stores its own internal timestamps that typically start at or near zero. When two files are concatenated without adjustment, the second file's timestamps jump backward — a _non-monotonic timestamp sequence_ — which is a fundamental violation of the MPEG-TS and HLS streaming protocols.

The effects of non-monotonic timestamps on clients are severe:

- **HLS players** (including hls.js, the most widely used browser HLS implementation) freeze at the transition point, loop on the same segments repeatedly, and often fail to recover without a full reload.
- **Hardware set-top box decoders** lose audio/video synchronization and may display corrupted video until the next clean keyframe.
- **FFmpeg itself** emits "Non-monotonous DTS in output stream" warnings, which indicate structurally broken output.

Tunarr solves this by tracking the exact timestamp of the last packet in each segment and passing a precise offset to the next transcode session so that the output timestamps are always monotonically increasing across the entire channel's lifetime — regardless of what the source files contain internally.

### HLS segment boundaries require forced keyframes

HLS (HTTP Live Streaming) — the protocol used to deliver Tunarr's output to most clients — splits the stream into short segments (typically 2–4 seconds each). Clients must be able to begin decoding from the start of any segment. This requires each segment to begin with an IDR (Instantaneous Decoder Refresh) keyframe: a frame that is fully self-contained, references no prior frames, and completely resets the decoder's internal state.

Source files contain keyframes at intervals chosen by whoever encoded them — which may be every 5, 10, or even 250 frames. Tunarr's transcoding pipeline forces a keyframe at every segment boundary, ensuring clients can always start cleanly at any segment entry point.

### The FFmpeg concat demuxer enforces consistency

When Tunarr uses FFmpeg's concat demuxer to assemble back-to-back programs, FFmpeg's own documentation states: _"All files must have the same streams (same codecs, same time base, etc.)"_. Feeding files with different codecs, time bases, or resolutions into the concat demuxer without prior normalization either fails immediately or produces a broken output stream.

### Why can't Tunarr at least copy-stream matching content?

Even when two adjacent programs happen to share the same codec and resolution, copy-streaming (remuxing without re-encoding) still fails to solve the timestamp non-monotonicity problem without substantial per-file analysis. It also cannot handle the less obvious mismatches: differing H.264 profiles or levels, different encoder-specific SPS/PPS decoder configuration parameters, different color space metadata, or subtle frame rate variations between `23.976` and `24.000` fps content. Detecting all of these accurately for every possible source file format is more complex and less reliable than normalizing everything to a known, consistent output.

Transcoding guarantees correctness. The trade-off is CPU and GPU usage — which is why Tunarr supports hardware-accelerated encoding (NVENC, QSV, VAAPI) to reduce the computational cost where capable hardware is available.

## Why does `data.ms` appear to be 2TB?

Tunarr uses [Meilisearch](https://www.meilisearch.com/) for search functionality. Meilisearch creates a file called `data.ms` in the Tunarr configuration directory that may appear to be approximately 2TB in size. **This file is NOT actually taking up 2TB of disk space.**

The `data.ms` file is a [sparse file](https://en.wikipedia.org/wiki/Sparse_file), which means it only allocates disk blocks for data that has actually been written. The reported size is the *virtual* size, while the actual disk usage is typically only a few megabytes.

You can verify the actual disk usage with:

```bash
# Linux/macOS - shows actual blocks used
du -h /path/to/tunarr/.tunarr/data.ms

# Compare with apparent size
ls -lh /path/to/tunarr/.tunarr/data.ms
```

### Excluding `data.ms` from backups

Since `data.ms` is a sparse file that can be regenerated by Meilisearch, you may want to exclude it from manual backups to avoid issues with backup tools that don't handle sparse files well.

**rsync:**

```bash
rsync -av --exclude='data.ms' /path/to/tunarr/.tunarr/ /backup/destination/
```

**tar (with sparse file support):**

```bash
# Use --sparse flag to handle sparse files efficiently
tar --sparse -cvf backup.tar /path/to/tunarr/.tunarr/

# Or exclude it entirely
tar --exclude='data.ms' -cvf backup.tar /path/to/tunarr/.tunarr/
```

**Duplicati:**

Add `data.ms` to your exclusion filters in the backup configuration.

**Borg Backup:**

```bash
borg create --exclude '*/data.ms' /path/to/repo::backup /path/to/tunarr/.tunarr/
```

**restic:**

```bash
restic backup --exclude 'data.ms' /path/to/tunarr/.tunarr/
```

!!! tip
    The Meilisearch index can be rebuilt automatically by Tunarr, so excluding `data.ms` from backups is generally safe, so long as the `ms-snapshots` directory is preserved. After restoring a backup without this file, Tunarr will recreate the search index on startup.
