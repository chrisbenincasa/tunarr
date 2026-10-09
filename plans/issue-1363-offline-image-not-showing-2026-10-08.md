# Issue #1363: fallback image does not show during flex

> **Status (10/08/2026):** Reproduced on the 0.22.2 command. Fixed in v1.3.6 by `68b1958e5` (#1906). Next step is to close the issue.

## Report

- Version 0.22.2, Docker, software encoding.
- The channel's fallback image (Flex tab) never appears in a flex gap with no filler.

## Root cause

- The offline session read the image with no `-loop 1`, so ffmpeg decoded a single frame.
- Audio was padded to the full flex length, so HLS segments claimed the full duration but carried one video frame.
- Players showed the last frame of the previous program, or nothing.

## Fix

- `68b1958e5` sets `infiniteLoop: true` in `createOfflineSession` (`server/src/ffmpeg/FfmpegStreamFactory.ts`).
- `InfiniteLoopInputOption` turns that into `-loop 1` for still-image inputs. First tag is v1.3.6.

## Verification

- Ran the reporter's ffmpeg command against a JPG served over local HTTP, with a 12 s duration.

| Input flags | Segments | Video frames |
|-------------|----------|--------------|
| `-readrate 1.0` (0.22.2) | 1 segment, 12.0 s | 1 |
| `-loop 1` (`main`) | 3 segments, ~4 s each | 96 each (24 fps) |

- Not tested through a running server, because the stream-repro skill cannot build a flex gap or set an offline picture.
