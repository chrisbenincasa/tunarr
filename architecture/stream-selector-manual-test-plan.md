# Stream Selector Integration — Manual Test Plan

PR #1874 · branch `integrate-stream-selector` · drafted 2026-09-18

## Scope

The PR wires `StreamSelector` into the ffmpeg pipeline, fixes two regressions the
integration introduced, and fixes two bugs an external review found. Unit tests
cover the evaluator. These cases cover what unit tests cannot — real containers,
real track layouts, real ffmpeg output.

## What is being verified

| Fix | Behavior before | Behavior after |
|---|---|---|
| Parity fallback | `default` action returned `null` when no track carried the default flag | Falls back to the first candidate |
| `audioDetails` requirement | Subtitle selection was skipped when a file had no audio streams | Subtitles resolve independently of audio |
| `subtitlesEnabled` gate | Passthrough path ignored the channel toggle | Passthrough honors `channel.subtitlesEnabled` |
| `preferTextBased` ordering | Image-based subs sorted first, so text subs lost | Text-based subs sort first |

## Why these cases

Track layouts were surveyed with ffprobe across a real library of roughly 600
movies and 240 TV shows. Three findings drive the plan.

- **Roughly 75–80% of files with subtitles carry no default flag**, in both
  movies and TV. The parity fallback therefore affects most playback, not an
  edge case.
- **Mixed image + text containers appear in about 14% of movies and none of the
  TV.** The ordering fix is effectively movies-only.
- **Files with zero audio streams are rare but real**, and at least one pairs
  zero audio with an external sidecar subtitle. That combination is what the
  `audioDetails` fix exists for.

Sourcing files for each case below is a matter of running ffprobe over a library
and filtering on stream counts and disposition flags.

## Setup

Create two channels over the same content.

- **Channel A** — passthrough / HlsDirectV2. Exercises `buildPassthroughSubtitles`.
- **Channel B** — transcode. Exercises `SubtitleFilter` burn-in.

The fixes sit on opposite sides of the pipeline, so every case runs on both.

## Cases

### 1. No-default fallback

**Needs:** a file with one or more subtitle tracks, none flagged default.

Set the subtitle action to `default`. Subtitles must appear. Before the fix this
returned `null` and subtitles were silently dropped.

### 2. Text-based preference beats image-first ordering

**Needs:** a file with many image-based subtitle tracks and exactly one text
track, none flagged default. A ratio around 30:1 is the sharpest available test.

With `preferTextBased` on, the single text track must win. Before the fix the
sort placed image tracks first and one of those was selected.

### 3. Ordering, second opinion

**Needs:** two or three more mixed files at a lower ratio, around 7:1.

Same assertion as case 2, to confirm the result is not an artifact of one file's
internal track order.

### 4. Subtitles with no audio, external sidecar

**Needs:** a video file with zero audio streams, zero embedded subtitle streams,
and a sidecar subtitle file beside it.

The sidecar must load. Before the fix, absent audio meant subtitle selection
never ran at all.

### 5. `by_language` with real competition

**Needs:** 5 or more audio tracks and 30 or more text subtitle tracks.

Pick a language present in both track sets. Confirm the audio and subtitle
selections agree, and that `preferChannels` resolves to the intended mix.

### 6. `by_language` across both subtitle types

**Needs:** multiple audio tracks, a large mixed image + text subtitle set, and at
least one subtitle track with no language tag.

Exercises `allowImageBased` in both positions and confirms untagged tracks do not
break the language matcher.

### 7. Forced-subtitle filter

**Needs:** a file with exactly one forced track among many, none flagged default.
Episodic TV is a reliable source.

Set `filterType: forced`. Only the forced track may be selected.

### 8. Untagged language does not crash the matcher

**Needs:** a file whose only subtitle track carries no language tag.

Run a `by_language` action. Selection must fall through cleanly rather than throw.

## Also worth a look

`buildPassthroughSubtitles` lacks the `isExternal` guard the transcode path
carries at `FfmpegStreamFactory.ts:533`. It is unreachable today because the
passthrough path only ever receives sidecar subs, but the asymmetry is fragile.
Not changed in this PR.
