# Filler audio levels (#1023)

> **Status (11/07/2026):** v1 built on branch `feat/flex-audio-volume`. It adds filler volume and filler loudnorm to the transcode config, legacy ffmpeg path only. §2 lists the gaps. PR #2459 is open. The ErsatzTV next issue draft (§3.2) waits on Christian's review before filing.

## 1. What v1 does

- Two nullable transcode config columns, `filler_audio_volume_percent` and `filler_audio_loudnorm_config` (migration `0056_dashing_molly_hayes.sql`).
- Null means the filler uses the channel's level. Each field falls back on its own.
- "Filler" means lineup items of type `commercial` (filler lists) and `fallback` (channel fallback filler).
- `resolveAudioLevels` (`server/src/ffmpeg/AudioLevels.ts`) picks the levels. `FfmpegStreamFactory.buildTranscodeInputs` calls it once per program.
- A filler loudnorm config turns normalization on for filler even when the channel has it off.
- The editor lives under "Filler Audio" in the transcode config audio tab. Docs are in `docs/configure/ffmpeg/transcode_config.md`.

## 2. Gaps

| Gap                                  | Effect                                                                                                                                                                             | Fix                                                                                                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No per-filler-list levels            | The issue asks for "per channel or per flex list". v1 is per transcode config, so it is shared by every channel that uses that config                                              | Same two columns on `filler_show`. Resolve filler list → transcode config filler → channel. `CommercialStreamLineupItem.fillerListId` is already on the item                  |
| Fallback shares the filler levels    | The channel fallback cannot differ from filler lists                                                                                                                               | Comes free with per-filler-list levels if fallback keeps the transcode config value                                                                                           |
| Filler cannot turn loudnorm off      | Null means "same as channel", so there is no way to say "off for filler only"                                                                                                      | Tri-state field (`inherit` / `off` / config)                                                                                                                                  |
| Volume % does nothing under loudnorm | `BasePipelineBuilder` adds the volume filter (`:706`) before loudnorm (`:732`), and loudnorm pulls the level back to its target. Users have to lower the filler `I` target instead | Under loudnorm, map volume % to loudnorm's `offset` gain (`20·log10(pct/100)` dB). `LoudnormConfig.offsetGain` already exists. Verify `offset` behavior in dynamic mode first |
| Volume 0 can't mute                  | The volume filter is skipped when the value is `<= 0` (`BasePipelineBuilder.ts:709`), so 0 plays at full volume. v1 rejects filler values below 1                                  | Apply `volume=0` for 0, after checking no existing config stores 0 by accident                                                                                                |
| ErsatzTV next ignores it             | ETV next channels play filler at channel level. It already ignores `audioVolumePercent` too. Both show in the editor's ignored-settings list                                       | §3                                                                                                                                                                            |

## 3. ErsatzTV next: per-item audio overrides

### 3.1 Verified state (schema at `c5cb065`)

- `normalization.audio` in `channel_config.json` is the only loudness control, and it applies to the whole channel.
- Neither the channel nor the item has a gain or volume control.
- `PlayoutItem` already carries per-item overrides, namely `watermark` and `graphics`.
- Dynamic sources already call Tunarr once per item (`/api/etv/playout-item`). That gives a per-item callback for free, so the missing piece is the fields, not a new mechanism.

### 3.2 Draft issue

- The draft lives in `etv-next-per-item-audio-issue-2026-11-07.md`, checked against the schema at `c5cb065`.
- It proposes an optional `audio` block on `PlayoutItem`. The block reuses the channel's field names (`normalize_loudness`, `loudness`) and adds `gain_db`.
- An omitted field keeps the channel's value, so `normalize_loudness: false` turns normalization off for one item.
- Open questions are copy mode, a channel-level `gain_db`, and per-item overrides beyond audio.

### 3.3 Tunarr side once upstream lands

- `EtvNextPlayoutItemMapper` sets `audio` from `resolveAudioLevels` for filler items.
- `EtvNextChannelConfigMapper` drops the two filler notes from `findIgnoredSettings`, and drops `audioVolumePercent` if channel gain lands.
- Record the issue in `ersatztv-next-upstream-blockers-2026-09-30.md` §4 when filed.
