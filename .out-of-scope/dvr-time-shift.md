# DVR and Time-Shift Buffering

Tunarr does not keep a server-side buffer that viewers can pause, rewind, or fast-forward through. It also does not record channels for later playback.

## Why this is out of scope

Tunarr emulates live TV. A channel plays what its schedule says is on right now, and every viewer sees the same moment. On-demand channels bend this a little because they advance only while someone watches, but they still play forward from a single shared position.

A DVR or time-shift buffer works against that model. It gives each viewer a private timeline that drifts away from the channel. Building one would also turn Tunarr into a different kind of server:

- Transcoded segments kept on disk per channel or per viewer, with retention rules and cleanup
- Per-viewer playback positions alongside the channel's own position
- Seek and scrub support in the stream endpoints, which serve live HLS and MPEG-TS today
- A guide and lineup that no longer describe what a viewer is actually watching

## What to use instead

- **The client's own time-shift.** Plex, Jellyfin, and Emby live TV players keep a local buffer while you watch, so you can pause and rewind within a session.
- **The media server's DVR.** Tunarr emulates an HDHomeRun tuner, so Plex and Emby DVR can record Tunarr channels like any broadcast channel.
- **Resume padding on on-demand channels.** #2328 rewinds an on-demand channel by a set number of seconds each time it pauses. It covers the common case of losing a few seconds that the client buffered and then threw away on exit.

## Prior requests

- #2328 — "Optional 'Seek Back on Resume' padding for On-Demand channels" (the DVR half; the padding half was accepted)
