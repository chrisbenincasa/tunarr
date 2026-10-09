# Issue #2043: Standard HLS stalls at program boundary

> **Status (10/09/2026):** Reproduced with stream-repro. A program whose media ends 220 s early leaves the HLS playlist frozen for 215 s. Fix deferred: the trigger looks rare and the remediation design is non-trivial. Design recorded below; findings posted to #2043.

## Report

- Tunarr 1.3.13, Docker, CUDA, Plex DVR, stream mode `hls`
- `channel-5-transcode exited. (signal=null, code=0, expected?=true)` at 14:02:29
- No further Tunarr output for 4 minutes; Plex `.ts` requests hang ~180 s, then Plex kills the session
- Intermittent

## Evidence limits

- `Starting ffmpeg with args` logs at `debug` (`server/src/ffmpeg/FfmpegProcess.ts:80`); the reporter's log is `info`
- "No successor start in the log" therefore proves nothing either way
- No program titles, durations, or debug logs attached

## Root cause (likely)

`HlsSession.run()` (`server/src/stream/hls/HlsSession.ts:230`) schedules transcodes by a wall-clock estimate, not by what ffmpeg actually produced.

- Before ffmpeg starts, `transcodedUntil` advances by the full `streamDuration` (`HlsSession.ts:363`)
- The loop starts the next transcode only when `transcodedUntil - now <= 60s`; otherwise it sleeps 5 s and re-checks
- Nothing corrects `transcodedUntil` when ffmpeg exits early
- So if ffmpeg exits with code 0 before producing `streamDuration` of output, the session sits idle for `(shortfall - 60s)`. The playlist stops growing and clients starve.

Ways ffmpeg exits 0 early:

- Plex/Jellyfin HTTP input closes mid-program; ffmpeg treats it as EOF
- The media file is shorter than the duration Plex reports (`-t` caps the output length but cannot extend it)

The logic is identical in `v1.3.13`.

## Reproduction

```
node .claude/skills/stream-repro/scripts/repro.mjs --clip-durations 60,240,60 --truncate-clip 2:20 --mode hls --seconds 200
```

- clip02 is scheduled for 240 s but its file holds 20 s
- clip02's ffmpeg starts at 12.8 s and exits `code=0, expected?=true`
- The last clip02 segment is fetched at 33.3 s; the next segment arrives at 248.5 s (215 s gap)
- clip03's ffmpeg starts at 243.3 s, which is `transcodedUntil` (300 s) minus the 60 s buffer
- Without reconnect flags, an HTTP source that drops mid-stream ends ffmpeg with exit 0 (`Error during demuxing: Input/output error`, no `-xerror`)
- With Tunarr's flags (`-reconnect 1 -reconnect_on_network_error 1 -reconnect_streamed 1`), a source that stays down made ffmpeg retry, then hang past a 10-minute timeout. The test server was crude, so treat this loosely. Short media is the more likely cause of the reporter's clean exit

## Fix design (deferred)

Filling dead air is easy. The hard part is that any visible error generates user reports, so each fill needs context and a remediation.

### Classify the shortfall at exit

- Inputs: scheduled `streamDuration`, duration ffmpeg actually produced, ffmpeg stderr
- Clean end of input, no input errors → media shorter than recorded (file replaced, stale metadata)
- Input I/O errors → media server dropped the stream

### Short media

- Fill the rest of the slot with the channel's offline screen, not the error screen
- Queue a rescan of that one program (`POST /programs/:id/scan`, `api/programmingApi.ts:893`)
- No user action needed; the next airing has the right duration

### Source dropped

- Retry the same program at its current offset a few times
- On failure, show the error screen with a subtitle that names the source ("Lost connection to Plex server 'X'")
- Needs hang detection (`-rw_timeout` or similar), since with Tunarr's reconnect flags a dead source may hang rather than exit

### User-facing context

- `warn` log: program, scheduled vs. produced duration, cause, action taken
- Health check under `services/health_checks/` listing programs that ended early recently

### Phases

- Phase 1: classification, offline fill, single-program rescan, warn log (`HlsSession`, `HlsSlowerSession`)
- Phase 2: retry on source drop, hang detection, health check
- Open question: is an automatic single-program rescan acceptable?

### Cheap diagnostics, independent of the fix

- Promote `Starting ffmpeg with args` (`server/src/ffmpeg/FfmpegProcess.ts:80`) to `info`, or log a one-line start at `info`, so boundary failures are visible in default logs

## Related

- #1727: same symptom on 1.2.x macOS; same loop
- `HlsSlowerSession.ts:125` uses the same pattern
