# Dynamic schedules — design review

- **Date:** 2026-09-13
- **Subject:** PR #1927 (branch `infinite-schedules`, squash commit `9eeafa1e`, base `dev`)
- **Method:** Five read-only passes covered the data model, planner, runtime integration, drift from `dev`, and the web UI. Every blocker was re-checked by hand.
- **Evidence:** Paths and line numbers are at `9eeafa1e` unless marked. "Verified" means the code was read or run. "Inferred" means the finding follows from the code but wasn't run.
- **Decisions:** D1–D3 and Q1–Q10 are in the [README](./README.md#settled-decisions).

## Branch history

| Ref | Date | State |
|---|---|---|
| `a3e63e49` | 2026-01-27 | Original feature commit |
| `tanstack-form-rewrite-infinite-schedules` | last 2026-03-20 | Local branch. Has 5 checkpoint commits that aren't in `4ca4b75d`. Holds the March filler playback-mode UI work |
| `4ca4b75d` | 2026-04-30 | Slot linking, based on `dev@7d259340`. Clean: no conflict markers, legacy form intact, test constructor matches, playback-mode UI present |
| `9eeafa1e` | 2026-06-18 | Rebased onto `dev@1abd59a3` and squashed. Damaged, see blockers. This is the PR head |
| `origin/dev` | 2026-09-13 | 90 commits past `1abd59a3`, about 20 of them in scheduling |

## Blockers

| # | Blocker | Origin | Evidence |
|---|---|---|---|
| B1 | The stream looks up generated items by schedule UUID instead of channel UUID. The lookup always misses, and the stream silently falls back to the classic lineup | Original, present at `4ca4b75d` | `StreamProgramCalculator.ts:107-126,631-633` → `InfiniteScheduleDB.ts:707-721`. Verified |
| B2 | The guide refill calls `generate(channel.uuid)` with no start time, so it regenerates from now over the existing buffer. `generationCursor` is written three times and never read. Overlapping rows are picked arbitrarily (`findFirst` with no `orderBy`) | Original, present at `4ca4b75d` | `TvGuideService.ts:1036`; `InfiniteScheduleGenerator.ts:185,639,1285,1771`. Verified |
| B3 | Flex and redirect slots advance time 1 ms per visit when `padToMultiple` is 0, which is the default. Mixed with content slots, they emit 1 ms junk items. A schedule of only flex or redirect slots loops about 6×10⁸ times per 7-day buffer, and a redirect slot also stores an item each loop. A shuffle slot whose show is empty loops the same way. All of this runs inside the guide build | At PR head | `InfiniteScheduleGenerator.ts:933-969,1466,1486,1523`; `schema/InfiniteSchedule.ts:20`. Verified |
| B4 | Classic `SlotWithFiller` moved from `LegacySlotFiller` (`types[]`) to `SlotFiller` (`type`). Saved lineups then fail `LineupSchema`, the adapter returns `null`, and lowdb keeps its empty default. A later write overwrites the file | Rebase. Classic used `LegacySlotFiller` at `4ca4b75d` | `types/src/api/CommonSlots.ts:185-187`; `SchemaBackedJsonDBAdapter.ts:45-69`; lowdb `Low.js:15-19`. Mechanism verified, overwrite inferred |
| B5 | The migration chain is corrupt. The 0045 snapshot comes from another lineage: its `prevId` doesn't match, it has a stray `channel_custom_show` table, and it's missing tables. `0046` collides with `dev`'s `0046_melted_captain_flint`, and #2072 and #1897 both already claim `0047` | Likely rebase. `4ca4b75d` had `0045_add_slot_linking` | `meta/0045_snapshot.json`, `_journal.json`. Verified |
| B6 | The web build fails. Two files contain committed conflict markers, and TS 5.9.3 reports 54 errors across 13 files. The classic `EditSlotProgrammingForm` lost its imports | Rebase. Clean at `4ca4b75d` | `routes/channels_/test.tsx:5-9`; `routes/library/fillers_/$fillerId/programming.tsx:8-20`. Verified |
| B7 | All 37 planner tests fail. The tests pass `(logger, db, helper)` but the constructor takes `(db, helper)` | Rebase. They matched at `4ca4b75d` | `InfiniteScheduleGenerator.test.ts:215-221`; `InfiniteScheduleGenerator.ts:162-167`. Verified by running |
| B8 | Nothing in the UI can assign a schedule to a channel. The Scheduling tab binds `scheduleId`, which the channel update route never writes, and no UI calls the assign endpoints | At PR head | `ChannelScheduleConfig.tsx:75-96`; `channelConverters.ts:64`; `channelsApi.ts:265`. Verified |
| B9 | Saving a schedule wipes channel state. `replaceSlots` deletes and re-inserts every slot, and cascades erase slot state and generated items for every channel on the schedule. None of it runs in a transaction | At PR head | `InfiniteScheduleDB.ts:509-526`; `EditScheduleForm.tsx:63-65`. Server verified, web trigger inferred |
| B10 | The dynamic slot's filler tab edits the wrong field. It binds `filler[].types`, but the server persists `fillerConfig`, so filler set in the UI never reaches the planner | Rebase and original | `EditScheduleSlotForm.tsx:607`; `SlotFillerDialogPanel.tsx:37,167`. Verified |

## Findings

### Data and persistence

- **Writes aren't atomic or serialized.** Item inserts, slot state and schedule state commit separately. A guide refill and an API regenerate can interleave. No unique index covers `(channel_uuid, sequence_index)`.
- **Cascades delete user config.** Slot FKs to shows, custom shows, filler lists, smart collections and redirect channels are all `ON DELETE CASCADE`. Deleting a filler list, or purging a trashed show, silently deletes the slots that use it (`InfiniteScheduleSlot.ts:78-92`).
- **Nothing handles the program lifecycle.**
  - `generated_schedule_item.program_uuid` cascades, so a purge leaves holes, and the stream errors at a hole.
  - Missing programs aren't filtered out.
  - Dynamic schedules need to become a named `ProgramLifecycleService` consumer (`server/01-program-lifecycle.md`, decision 7).
- **FK columns lack indexes.**
  - `program_uuid`, `slot_uuid`, `filler_list_id` and `redirect_channel_uuid` have no index, so each purged program forces a full scan.
  - `channel_uuid` has a redundant single-column index.
- **The time zone is a minute offset.** The DST guess fails in three cases: a UTC server running a non-UTC schedule, zones within 60 minutes of each other, and the southern hemisphere (`InfiniteScheduleGenerator.ts:709-742`).
- **The channel link has no FK.** `channel.infinite_schedule_uuid` has no foreign key, and `infinite_schedule_state.schedule_uuid` duplicates it.
- **Smaller bugs:**
  - `createSchedule` drops `slotPlaybackOrder`.
  - `updateSlot` overwrites `createdAt`.
  - `getItemAtTime` matches the end time with `>=`.
  - Cleanup filters on `start + duration`, which scans the whole table.
- **Mid-roll needs a start-offset column.** Adding it now avoids a second migration.
- **The row model scales.** A 7-day buffer is about 1–3k rows per channel once B2 is fixed (inferred), and the hourly cleanup keeps it bounded.

### Planner

- **Classic and dynamic duplicate low-level building blocks.** D1 keeps the planners separate. But the dynamic engine also re-implements content iterators, flex handling, season filtering and linking. It doesn't use `FillerPickerV2`, `createSlotIterators` or mid-roll. That's why it repeats bugs `dev` already fixed in classic (see parity). Slice 1 moves those building blocks into shared, serializable code.
- **Anchored `fill` contradicts D3.** An anchored `fill` stops after one program (`InfiniteScheduleGenerator.ts:844`, comment "anchored fill = emit exactly one, then stop"). The gap to the next anchor becomes flex.
- **Hard anchors hold only for ordered `fill` slots.** `count` and `duration` slots run past a hard anchor (`:1018-1023`), while shuffle mode guards every fill mode (`:1533`).
- **Anchor behavior matches neither the spec nor classic.**
  - Hard never skips.
  - Soft runs over, then fires late.
  - Nothing tolerates lateness the way classic `latenessMs` does.
- **Floating `fill` rotates after every program** (`:1137`). The spec says it fills until the window ends (Q2).
- **Two stored fields are never read.** `flexPreference` and `cooldownMs` exist in the schema, but the planner ignores both.
- **Resuming from saved state doesn't match one long run.**
  - Content shuffle never reshuffles (`:483-486`).
  - A continue-linked group restores from its first member's state (`:310`).
  - The rerun `consumedCount` isn't persisted (`:110-154`).
  - Anchored slots save `fillerState: null` (`:897,1425`).
  - Ordered mode stores a raw index, so removing an episode replays one (`test.ts:1491` asserts this).
- **`preview()` can't predict what airs.** It writes nothing, but it seeds fresh entropy and slot UUIDs every call (`:247-250`).
- **The duplication from the March cleanup plan remains.** The anchor loop, the 12-step filler pipeline and `pushOrExtendFlex` are each copied between ordered and shuffle modes. The `>0` vs `>1` check is a real bug: shuffle mode ignores `padMs` when `padToMultiple=1` (`:1570`).
- **Smaller bugs:**
  - Alphanumeric descending sorts by negative title length (`:517`).
  - Chronological sort mixes air dates with episode keys (`:520-526`).

### Runtime integration

- **The lineup mode is implicit.** A nullable column is checked in two places. These consumers ignore it:
  - the materialized schedule API
  - troubleshoot
  - duration reconciliation
  - classic-to-dynamic redirect resolution
  - the classic lineup itself, which stays a silent fallback

  D2 replaces all of this with an explicit mode.
- **The stream path skips classic safeguards** (`StreamProgramCalculator.ts:617-700`):
  - play history
  - retry throttling
  - short-offline skip
  - redirect loop detection (dynamic-to-dynamic redirects recurse without bound)
  - redirect duration cap
  - channel fallback filler during flex
- **The guide build runs generation.**
  - It swallows errors (`TvGuideService.ts:1039-1046`), which undoes #2000.
  - Under `dev`'s global `guideBuildLock`, one slow generation stalls every channel's guide.
  - `POST …/regenerate` doesn't share its lock.
- **Edits don't reach items already generated.** A slot update leaves stale items for up to `bufferDays`. Reassigning a channel leaves the old schedule's items in place, and they count as a full buffer.
- **A redirect slot makes schedule endpoints return 500.** `slotDaoToDto` has no redirect branch (`scheduleConverters.ts:29-71`).
- **The API has shape problems.**
  - Two overlapping route families exist, and most channel-scoped routes are dead.
  - The channel-scoped DELETE removes a shared schedule.
  - Slot delete returns 501.
  - Slot add and update skip validation.
  - A `repsonse` typo drops a response schema.
  - Four copies of the DTO-to-row mapping have drifted apart.
- **The integration conflicts with the server architecture plan** ([server/README.md](../server/README.md)).
  - It adds fields to `ServerContext`, which candidate #1 wants to retire.
  - It adds a third schedule evaluator, while candidate #2 wants one.
  - It would fit candidate #10 as a timeline source behind one port.

### Web

- **Deleting a schedule always returns 404.** The table calls the channel-scoped route with a schedule ID (`SchedulesTable.tsx:36-50`).
- **Slot editing is incomplete.**
  - The UI can't delete slots.
  - Drag-reorder swaps rows but keeps their `slotIndex`, so the new order doesn't persist (`ScheduleSlotTable.tsx:184-190`).
- **The linking control saves the other slot right away.** If the user abandons the form, the link is left half-saved (`InfiniteSlotLinkingControl.tsx:99-143`).
- **Preview has gaps.**
  - It ignores unsaved edits.
  - It drops `offline` items.
  - It renders redirects with channel number -1.
- **Forms use hand-written defaults instead of zod schemas.** Anchor time is entered in local time, but the spec defines it as UTC milliseconds.
- **The vocabulary is new.** It collides with the `CONTEXT.md` glossary, which says to avoid the bare word "schedule". Q1 decides the naming.
- **About 40 route files churn their IDs** (`/x_/` → `/x/`). This is a rebase artifact, and each file conflicts with `dev`.

## Parity with dev scheduler work since June

| `dev` change | Dynamic engine |
|---|---|
| Mid-roll filler (#1917, #1988) | Missing |
| Linked-slot independent filler (#1956) | Unaffected, because filler helpers are per slot |
| Filler iterators loop forever (#1967) | Unaffected |
| Random-slot cooldown (#2001) | Same bug: `cooldownMs` is never read |
| Shuffle reshuffles when it wraps (`16638d03`) | Same bug, in separate code |
| Season 0 filters (#1915, #1919) | Same bug, and there's no exclude filter |
| `FillerPickerV2` slack (#1907), channel fallback filler | Not used, so flex never plays channel filler |
| Mixed link modes, `rerunOverflow` | The dynamic validator rejects them |
| Unique slot IDs (#1933) | Unaffected |
| Lateness and overflow (#1965, open) | No equivalent (Q3) |
| Guide retry (#2000), `guideBuildLock` | Conflicts (see runtime integration) |

## Target architecture

1. **Shared building blocks, separate planners (D1).** Content iterators gain `serialize` and `restore`, and one season filter and one filler selector serve both engines. The classic and dynamic planners stay separate.
2. **An explicit lineup mode (D2).** A channel is either classic or dynamic. Every lineup consumer dispatches on the mode, and nothing falls back.
3. **Generation owned by a background buffer task.**
   - Per-channel lock and one transaction per run.
   - Resume from the cursor.
   - The guide and the stream only read.
4. **One timeline port.** Classic lineups and dynamic items each implement it, and the guide and the stream consume it.
5. **Edits as diffs.** Slots are updated, inserted and deleted by UUID in one transaction. Generated items are invalidated from now plus a grace period, then regenerated.
6. **Lifecycle-aware storage.**
   - Generated items use `SET NULL` and become flex on purge.
   - Slot FKs use `SET NULL` or `RESTRICT` and show a visible broken state.
   - Registered with `ProgramLifecycleService`.
7. **Schema.**
   - IANA zone, `end_time_ms`, start offset.
   - FK on the channel link.
   - FK indexes.
   - Unique `(channel_uuid, sequence_index)`.
   - CHECK constraints on enums.
8. **Types.** Dynamic filler has its own type, and the shared `SlotFiller` stays untouched.
9. **API.** One `/schedules` route family plus assignment, the controller and `mount` pattern, and server-minted IDs.
10. **Web.**
    - Lineup-mode switch with assignment.
    - Its own filler panel.
    - zod-driven forms.
    - Preview of unsaved edits.
    - Vocabulary reconciled with `CONTEXT.md`.
