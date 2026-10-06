---
name: stream-repro
description: Reproduce and measure Tunarr stream bugs on an isolated server. Boots a throwaway Tunarr server, builds a channel from synthetic clips (or a copy of the dev database), captures a bounded HLS or MPEG-TS sample, and reports per-segment tracks, A/V start offsets, timestamp gaps and overlaps, and the exact ffmpeg commands the server ran. Use this whenever a user report or issue describes playback symptoms such as duplicate or missing audio/subtitle tracks, audio out of sync or starting late, stutter or freezes at program transitions, streams that fail to start, or wrong resolution/codec after a program change, and whenever you need evidence that a streaming or ffmpeg pipeline change fixed such a symptom, even if the user only says "look into this stream issue".
---

# Stream repro

Stream bugs are hard to argue about from code alone, because the symptom only shows up in the bytes Tunarr
serves. This skill produces those bytes on a server nobody else uses and turns them into a report you can
cite. Run it before theorizing when a report describes a playback symptom, and run it again after a fix to
show the symptom is gone.

## Run it

Run from anywhere inside the repo. It needs `ffmpeg`/`ffprobe` on PATH (or `--ffmpeg`/`--ffprobe`) and the
Meilisearch binary that already ships in `server/bin/`.

```bash
node .claude/skills/stream-repro/scripts/repro.mjs [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--source synthetic\|copy` | `synthetic` | Generate clips, or replay a real channel from a copied database |
| `--layout basic\|multi-audio\|dup-lang\|subs\|mixed` | `basic` | Synthetic clip track layout (see below) |
| `--clips N`, `--clip-seconds S` | `3`, `60` | Number and length of synthetic clips; each clip is one program |
| `--db-dir DIR` | | `copy` only: Tunarr database directory to copy (the dev server's is `TUNARR_DATABASE_PATH` in `server/.env.development`) |
| `--channel ID` | | `copy` only: channel number or uuid to stream |
| `--mode hls\|hls_slower\|hls_direct_v2\|mpegts` | `hls` | Stream mode to request |
| `--seconds S` | `60` | How much stream to capture |
| `--out DIR` | temp dir | Where clips, database, capture, and `report.json` go |
| `--keep-server` | off | Leave the server running afterward for manual poking |
| `--rewind N` | | HLS only. After the capture, jump back N segments, then play on (see below) |
| `--rewind-polls P` | `8` | Playlist polls after the rewind, 2 s apart |
| `--reanalyze DIR` | | Re-score an existing capture without booting a server |

Pick the layout that matches the report. `dup-lang` has two `eng` audio tracks, one titled
Commentary, which is how a real library ends up with duplicate-language audio. `mixed` alternates resolution, frame rate, sample rate, channel
count, subtitles, and audio-track count between programs, so it exercises transitions hardest. Make the
capture long enough to cross at least two program boundaries: `--seconds` should exceed
`2 × --clip-seconds`.

Keep clips at 30 s or longer. Tunarr skips to the next program when a stream request lands with less
than 10 s left in the current one (`SLACK` in `shared/src/util/constants.ts`). Transcodes run faster
than real time, so short clips get skipped and the run tests a different transition than you intended.

A run takes one to three minutes. Most of that is server boot and real-time streaming.

## How it isolates itself

- A fresh database directory under `--out`, free random ports for HTTP and search, and bind to 127.0.0.1.
  Your dev server and its data are untouched.
- `TUNARR_USE_WORKER_POOL=false`. Eight `tsx` workers booting at once starve ffmpeg of CPU, and HLS startup
  then times out after 15 retries. That failure is an artifact, not a repro.
- `TUNARR_LOG_LEVEL=debug`, so every ffmpeg command line lands in `<out>/db/logs/tunarr.log`.
- `copy` mode copies the database directory except logs, backups, cache, and streams. It rewrites the
  copied `settings.json` logs path so the copy never writes into the original.

## Read the report

`<out>/report.json` holds:

- `channel`: channel id, `startTime`, and the lineup (titles and durations) for synthetic runs.
- `perPiece`: one entry per HLS segment, or one for the whole MPEG-TS capture. Each lists the streams
  (codec, language, size, fps, sample rate, channels), stream counts, whether an `#EXT-X-DISCONTINUITY`
  preceded it, and `avStartOffsetMs` (first audio PTS minus first video PTS).
- `findings`: one entry per detected anomaly, described below.
- `ffmpeg.commands`: every ffmpeg argv the server started, in order. There is roughly one per program.
- `sessionRestarts`: times the HLS session died and the capture restarted it.

| Finding | What it means |
|---|---|
| `track_layout_change` | Stream counts differ between consecutive segments. At a discontinuity this can be legitimate (the next program has other tracks). Elsewhere, or with counts that grow, it points at duplicated or dropped tracks. |
| `av_start_offset` | Audio starts more than 100 ms before (negative) or after (positive) video at the start of a program. |
| `pts_gap` | Timestamps jump forward by more than 3× the typical frame or packet spacing inside one continuous run. |
| `pts_overlap` | Many packets share nearly the same timestamp, which is what a backward jump looks like after sorting. `count` says how many. |
| `hls_session_restarted` | The HLS session died mid-capture. The reason is in `tunarr.log` near that time. |
| `rewind_target_missing` | The `--rewind` target was already pruned. Expected when N reaches past the retained window. |
| `playlist_lists_missing_segment` | A playlist after the rewind listed segments that 404. The playlist points at files pruning deleted. |

`--rewind` tests playlist trimming and pruning. Pruning runs at most every 30 s, so capture long enough
for it to fire, such as `--seconds 120`. The rewind client uses the capture client's IP, so the server
treats it as the same viewer. It fetches each newly listed segment once, in order, as a player would.
`report.rewind` records the target, its status, the total segment 404s, and for each poll the listed
range and the missing files.

Runs are split at discontinuities, so the expected timestamp reset between HLS programs is not flagged.
MPEG-TS concat captures form a single run. To place a finding in a program, compare its PTS with the lineup
durations, counting from `captureStartedAt` relative to `channel.startTime`.

Then tie the symptom to its cause. Find the ffmpeg command for the program where the finding sits, and read
the flags that differ from the neighboring programs. The pipeline that built those flags is under
`server/src/ffmpeg/builder/`.

## Report back

Lead with whether the symptom reproduced. Then give:

- The exact command you ran, so anyone can rerun it
- The findings that match the report, with segment or PTS and program
- The ffmpeg command or flags implicated
- What this run could not show, from the limits below

## Limits

Say these when they apply, because a clean report is only as strong as its inputs.

- **No Jellyfin or Emby media.** Synthetic clips go through a local media source. Bugs in Jellyfin/Emby
  stream details, canonicalization, or their direct-play paths will not reproduce. `copy` mode reaches
  Plex (and Jellyfin/Emby if the copied DB has them) only if those servers are reachable from this machine.
- **Synthetic clips are clean.** They have no broken timestamps, VFR, interlacing, HDR, or odd codecs.
  A clean run with synthetic media does not clear a user's file. Ask for an ffprobe of their file and
  mirror its layout when that matters.
- **PTS alignment is not lip sync.** `avStartOffsetMs` compares timestamps. It cannot see audio that is
  timestamped correctly but encoded late. Real lip-sync checks need decoded flash and beep markers,
  which this skill does not do.
- **No stream selection profile.** Synthetic channels use the legacy audio/subtitle selection fallback.
  If the reporter's channel has a stream selection profile, audio picking takes a path this run never
  touched. Ask, and use `copy` mode against a database that has the profile.
- **Software pipeline only**, unless the machine's hardware acceleration is configured in the copied DB.
- **Bounded sample.** Anything that happens after `--seconds` is out of view. Long-drift bugs need a
  longer capture.
