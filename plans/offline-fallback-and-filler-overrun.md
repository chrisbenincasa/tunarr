# Offline Fallback and Filler Overrun

> **Status (10/18/2026):** Proposed. Design settled (filler list as fallback, global defaults, precedence below). No code yet. Next step: build phase 1.

Trigger: a 2026.10.0 user report. Flex gaps now show the offline screen where 2026.9.3 played a filler clip and cut it off. Cause: PR #2241 (`7c9e5e9a7`) scaled the filler overrun tolerance to `min(SLACK, gap / 10)`.

## Goals

1. A channel setting, with a global default, that restores the 10 s filler overrun.
2. A per-channel fallback filler list that plays, and loops, when no filler fits a gap. No slot schedule required.
3. Global defaults for the offline image, soundtrack, and fallback filler list.

## Non-goals

- Slot-schedule fallback. Slots bake fallback filler into the lineup at schedule time (`RandomSlotsService.ts:418`), so those gaps are never offline at stream time. Unchanged.
- Guide output. Flex gaps stay "flex" in the guide and XMLTV.
- Reverting the 999 ms stream-tail threshold from #2241. That fix stops guide drift and stays.

## Current State

| Piece                    | State                                                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Filler overrun           | `fillerOverrunToleranceMs` (`FillerPickerV2.ts:33`) returns `min(SLACK, gap / 10)`. The cutoff at gap end already works (`StreamProgramCalculator.ts:524`). |
| `channel_fallback` table | Maps channel → program. No code writes to it. Read by `getChannelFallbackPrograms` (`ChannelProgramRepository.ts:356`).                                     |
| `offline.mode`           | `'pic' \| 'clip'` in the channel's `offline` JSON column. UI disables `'clip'` ("not yet implemented", `ChannelFlexConfig.tsx:429`).                        |
| Fallback playback        | `StreamProgramCalculator.ts:465-555`. A clip longer than the gap plays its tail. A shorter clip plays once, then the session ends and ffmpeg restarts it.   |
| Offline image            | Resolved in `FfmpegStreamFactory.ts:907` as channel picture → `/images/generic-offline-screen.png`.                                                         |
| Global settings          | lowdb `settings.json`, `SettingsSchema` (`server/src/db/SettingsDB.ts:59`). No channel-defaults section.                                                    |

## Design

### Precedence

When no filler fits a flex gap, the first source that resolves wins.

| #   | Source                       | Skipped when                                         |
| --- | ---------------------------- | ---------------------------------------------------- |
| 1   | Channel fallback filler list | Channel mode is `pic`, or no list set, or list empty |
| 2   | Global fallback filler list  | Channel mode is `pic`, or no list set, or list empty |
| 3   | Channel offline picture      | No picture set                                       |
| 4   | Global offline picture       | No picture set                                       |
| 5   | `generic-offline-screen.png` | Never                                                |

- Soundtrack follows the same picture chain (channel → global → silence).

### Offline mode

| Mode      | Meaning                                        |
| --------- | ---------------------------------------------- |
| `inherit` | Follow the full precedence table. New default. |
| `pic`     | Image only. Skip rows 1–2.                     |

- `clip` goes away. With `inherit`, setting a channel list already makes the channel clip win.
- Migration rewrites every stored `pic` and `clip` to `inherit`. No user could select `clip`, and keeping `pic` would hide the new global clip from every upgraded channel.
- The Zod `.catch('clip')` in `ChannelOfflineSettingsSchema` (`server/src/db/schema/base.ts:111`) becomes `.catch('inherit')`.

### Fallback clip selection

- Pick one program from the resolved list, seeded by `(channelId, gap programBeginMs)`. A reconnect mid-gap gets the same clip at the same position.
- Clip shorter than the remaining gap: set `infiniteLoop`, start at `elapsedInGap % clipDuration`, run to the gap end. Reuses the seek wrap from #2219.
- Clip longer than the remaining gap: keep today's tail alignment. Start at `clipDuration - remaining`, so the clip ends when the next program starts.
- Ignore repeat cooldowns. Fallback exists to always fill.
- Keep the `minimumWait` cap. Fallback yields when a real filler becomes eligible.

### Filler overrun

- `fillerOverrunToleranceMs(gap, allowOverrun)` returns `SLACK` when overrun is on, and `min(SLACK, gap / 10)` when off.
- Effective value: channel `allowFillerOverrun ?? channelDefaults.allowFillerOverrun`.
- Global default is `false`, so upgrades keep 2026.10.x behavior.

### Data model

| Change                            | Detail                                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `channel.allow_filler_overrun`    | `integer({ mode: 'boolean' })`, nullable. Null means "use the global default".                                                     |
| `channel.fallback_filler_list_id` | `text`, nullable, FK `filler_show.uuid` `ON DELETE SET NULL`                                                                       |
| `channel.offline` JSON            | `mode` rewritten to `inherit`                                                                                                      |
| `channel_fallback` table          | Dropped. Any existing rows become one auto-created filler list per channel ("<channel name> fallback"), linked via the new column. |
| `settings.json`                   | New `channelDefaults` key, below                                                                                                   |

```ts
channelDefaults: {
  allowFillerOverrun: boolean;       // default false
  offline: {
    picture?: string;
    soundtrack?: string;
    fallbackFillerListId?: string;
  };
}
```

- `settings.json` cannot hold a foreign key. A missing filler list resolves as unset, with one warning log. `FillerListDB.deleteFiller` (`FillerListDB.ts:201`) also clears a matching global id.

## Phases

Each phase ships as its own PR to `main`.

### Phase 1. Filler overrun setting

- Migration for `allow_filler_overrun` (`pnpm drizzle-kit generate`).
- Add the field to the channel schema in `types/`, and pass it through `BasicChannelRepository` create/update (`:73`, `:98`).
- Add `channelDefaults` to `SettingsSchema` with only `allowFillerOverrun`, plus its settings endpoint.
- Change `fillerOverrunToleranceMs` and its three call sites in `FillerPickerV2.ts`.
- UI:
  - Tri-state in `ChannelFlexConfig.tsx`: "Use global default / Allow / Don't allow". Label: "Let filler run past the flex gap and be cut off".
  - Global toggle in a new "Channel defaults" section on `GeneralSettingsPage.tsx`. A section avoids adding a route.
- Regenerate the OpenAPI spec and web client.
- Docs: `docs/configure/library/filler-selection.md`.

### Phase 2. Per-channel fallback filler list

- Migration: add `fallback_filler_list_id`, convert `channel_fallback` rows, drop the table, rewrite `offline.mode`.
- Replace `getChannelFallbackPrograms` with a query for the resolved list's programs.
- Rework `StreamProgramCalculator.ts:465-555` per "Fallback clip selection".
- Collapse the mode enum to `inherit | pic` in `types/` and server schemas.
- UI in `ChannelFlexConfig.tsx`:
  - Mode select: "Default" (inherit) / "Image only".
  - Filler list picker for the fallback list.
  - Keep the "requires ffmpeg transcoding" note.
- Docs: the channel flex section in `docs/configure/channels/properties.md`.

### Phase 3. Global defaults

- Extend `channelDefaults.offline` with `picture`, `soundtrack`, `fallbackFillerListId`.
- Inject `ISettingsDB` into the precedence resolution in `StreamProgramCalculator` (rows 2 and 4). `FfmpegStreamFactory` already holds it (`:113`).
- UI in the "Channel defaults" section: image upload (`ImageUploadInput`), soundtrack, filler list picker.
- Clear the global id in `deleteFiller`.
- Docs: a "Channel defaults" entry in the settings docs.

## Testing

| Layer                             | Coverage                                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `FillerPickerV2.test.ts`          | Tolerance with overrun on and off. A 12 s clip in a 3.6 s gap is picked only when on.                                                        |
| `StreamProgramCalculator.test.ts` | All five precedence rows. `pic` skips clips. Loop offset across a reconnect. Tail alignment for long clips. Seeded pick stable across calls. |
| Migration tests                   | `pic`/`clip` → `inherit`. `channel_fallback` rows → filler list.                                                                             |
| `stream-repro`                    | 3 s fallback clip in a 60 s gap. One ffmpeg process for the whole gap, and no timestamp gaps at loop points.                                 |
| e2e                               | Channel flex page and general settings page render clean. Update `knownIssues.ts` if needed.                                                 |

## Risks

- `-stream_loop -1` on remote inputs (Plex, Jellyfin, Emby over HTTP). #2219 relies on it for slot fallback, but verify a remote source in `stream-repro` before shipping phase 2.
- An extra query per flex gap on the streaming hot path (`StreamProgramCalculator.ts:450` already queries filler). Fetch the fallback list only after the picker returns nothing.
- Overrun on brings back clip fragments in short gaps. That is the opt-in behavior, so the setting label must say so.
