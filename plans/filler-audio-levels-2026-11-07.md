# Filler audio levels (#1023)

> **Status (11/07/2026):** v1 built on branch `feat/flex-audio-volume`. It adds filler volume and filler loudnorm to the transcode config, legacy ffmpeg path only. §2 lists the gaps. §3 drafts the ErsatzTV next issue, which waits on Christian's review before filing. Next step is the PR.

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

### 3.2 Draft issue (for ErsatzTV/next)

Title: `feat: per-item audio overrides in the playout`

> Tunarr lets users play filler (commercials, bumpers) at a different level than the main content on the same channel. Today loudness lives only in the channel config's `normalization.audio`, and there's no gain control at all, so a consumer can't vary audio level per item.
>
> Proposal: an optional `audio` block on `PlayoutItem` that overrides the channel's audio normalization for that item only. Like `watermark` and `graphics`, it rides on the item, so dynamic sources can return it from the existing per-item callback.
>
> ```json
> {
>   "id": "abc",
>   "source": { "...": "..." },
>   "audio": {
>     "gain_db": -6.0,
>     "loudness": {
>       "integrated_target": -30,
>       "range_target": 7,
>       "true_peak": -2
>     }
>   }
> }
> ```
>
> - `gain_db` applies on top of normalization. With loudnorm on, it could go through loudnorm's `offset` so the true-peak limiter still runs.
> - `loudness` replaces the channel's targets for the item. `null` turns normalization off for the item. Leaving it out keeps the channel's.
> - A channel-level `gain_db` in `normalization.audio` would let Tunarr map its existing volume setting too.
>
> Starting with audio only. Is a general per-item override of `normalization` (deinterlace, subtitle mode) worth designing for now?

### 3.3 Tunarr side once upstream lands

- `EtvNextPlayoutItemMapper` sets `audio` from `resolveAudioLevels` for filler items.
- `EtvNextChannelConfigMapper` drops the two filler notes from `findIgnoredSettings`, and drops `audioVolumePercent` if channel gain lands.
- Record the issue in `ersatztv-next-upstream-blockers-2026-09-30.md` §4 when filed.
