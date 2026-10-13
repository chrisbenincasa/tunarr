# Reshuffle Schedules on Loop

> **Status (10/11/2026):** Draft. Phase 1 (slot schedules) approved in principle. Phase 2 (manual
> lineups) is scoped here for a go/no-go decision. Nothing implemented.

Stopgap for dynamic schedules (Tunarr v2). When a channel's lineup reaches the end of its loop, the
server builds the next loop from the same schedule, with randomness redrawn from the same seed
advanced by the number of draws already used. Users get a fresh shuffle each loop without waiting
for v2.

## Goals

- Slot channels (time and random slots) get a new shuffle every loop.
- Ordered shows continue where they left off instead of restarting each loop.
- The guide and XMLTV show the next loop before it airs.
- Code stays small and isolated, so v2 can replace it without a migration story.

## Non-goals

- On-demand channels. Their position comes from `onDemandConfig.cursor`, not `startTime`.
- Custom show editors (`useCustomShowBlockShuffle`, `useCustomShowRandomSort`).
- Replaying every loop missed while the server was down. A catch-up builds one loop and moves on.

## Current state

| Piece                           | Where                                                        | State                                                                                               |
| ------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Slot schedule definition        | lineup JSON (`LineupRepository.ts`)                          | Stored                                                                                              |
| `scheduleSeed`                  | lineup JSON                                                  | Stored on slot save, cleared on manual save                                                         |
| RNG skip count (`discardCount`) | `TimeSlotService.ts:101,481`, `RandomSlotsService.ts:79,204` | Accepted and returned by the schedulers, never stored                                               |
| Rebuild from schedule           | `RegenerateChannelLineupCommand.ts`                          | Replays seed from `startTime`, so the same draws every time                                         |
| Slot iterator position          | `ProgramIterator.ts` (`IndexBasedProgramIterator.position`)  | In memory only, starts at 0 every build                                                             |
| Manual tool ops                 | `web/src/hooks/programming_controls/`                        | Run in the browser; the server only sees the result                                                 |
| Channel position                | `(now - startTime) % duration`                               | `startTime` is rounded down to the minute on every `updateChannel` (`BasicChannelRepository.ts:46`) |

## Shared mechanism: the loop boundary

Both phases need the same swap. It lives in one service (working name `LoopRegenerationService`)
driven by one scheduled task.

### Extend, then trim

1. **Extend.** When the time left in the current loop drops below the guide horizon
   (`xmlTvSettings().programmingHours`) plus a margin, do two things in one write:

   - Move `startTime` to the start of the current loop: `startTime += k * duration`, where
     `k = floor((now - startTime) / duration)`.
   - Append the next loop's items. `duration` becomes the sum of both loops.

   The channel position is unchanged, because `now - startTime` is still less than the old duration.
   The guide now sees real future programming.

2. **Trim.** Once `now` passes the old boundary, drop the first loop's items and add its duration to
   `startTime`. The position is again unchanged.

### Whole-minute loops

`updateChannel` rounds `startTime` down to the minute, and that rounding stays. Instead, every loop
ends with a flex item that pads its duration up to the next whole minute (at most 59.999 s).

- Each built loop gets this pad before it is appended.
- The first loop gets it when the user saves with the toggle on. The save already rewrites the
  lineup and `startTime`, so padding there costs nothing.
- With every loop a whole number of minutes, `startTime += k * duration` and the trim's
  `startTime += loopDuration` always land on a minute, so the existing rounding never moves the
  channel.
- A loop that is already a whole number of minutes, such as a full-day time-slot schedule, gets no
  pad.

### Task

- A `ScheduledTask` runs every few minutes and checks each opted-in channel for an extend or trim
  that is due.
- On startup the task runs once. If a channel is past its boundary with no next loop built, it
  builds one loop starting at the current loop start and skips the missed loops.
- After each swap it calls `tvGuideService.updateCachedChannel(channelId, true)`, as
  `RegenerateChannelLineupCommand` already does.

### Opt-in

Add a per-channel toggle, "Rebuild each loop", defaulting to off. Turning it on changes behavior
even for fully ordered schedules, because ordered shows stop repeating, so existing channels must
not change silently.

### Risks to verify

- Sessions that are already streaming may hold a lineup index, not a timestamp. Check
  `StreamProgramCalculator` and the HLS/concat sessions for indexes that survive a lineup swap.
- `ReconcileProgramDurationsTask` patches lineups after scans. It must not run on a lineup in the
  extended state with stale assumptions about the loop length.
- A slot save from the editor resets the seed, the skip count, the iterator state and `startTime`.
  That is expected, but the toggle state must survive it.
- `ReconcileProgramDurationsTask` can change a loop's length after a scan. It must re-pad the loop to
  a whole minute, or the next rebase lands off the minute.

## Phase 1: slot schedules

### Data (lineup JSON, all optional)

- `scheduleDiscardCount: number`, the RNG skip count after the last built loop.
- `slotIteratorState: Record<SlotIteratorKey, { lastProgramId: string }>`, the last program each
  ordered iterator emitted.
- `rebuildEachLoop: boolean`.

New optional fields need no `ChannelLineupMigrator` step.

### Scheduler changes

- `scheduleTimeSlots` and the random-slots equivalent accept an initial iterator state and return
  the final one, next to `discardCount`.
- An ordered iterator resumes just after `lastProgramId` in its sort order. If that program is gone,
  it starts at 0.
- Shuffle iterators restart with a fresh permutation each loop. A show can repeat an episode near
  the boundary before every episode has aired. That is acceptable for a stopgap. Persisting the
  played-this-pass IDs fixes it later if users complain.

### Regeneration

- Extend `RegenerateChannelLineupCommand` (or a sibling command) to take `startTime`, `seed`,
  `discardCount` and iterator state, and to return the items for one loop without saving.
- The boundary service does the save.

### Web

- Add the toggle to the slot editor.
- Optionally show "rebuilt N times, next rebuild at T" on the channel page.

### Size

Medium. The scheduler and iterator plumbing is mechanical. The boundary swap and its tests carry
most of the risk.

## Phase 2: manual lineups (minimal)

### Problem

A manual lineup is a list the browser already shuffled. To reshuffle it, the server needs the list
before the shuffle and the operations applied after it.

### Recipe

When the user saves, the web client sends an optional recipe with the manual lineup.

- `base`, the item list as it stood just before the first randomizing op since the last load.
  Deterministic ops before that point are already baked into `base`, so they never replay.
- `ops`, an ordered list of `{ kind, config }` from the first randomizing op onward.

The server keeps the user's saved items, padded to a whole minute, as loop 1. From loop 2 on, it replays the recipe with its
own seeded RNG. Because loop 1 is what the user saw, the browser and server never need to produce
identical shuffles, which removes the hardest parity problem.

### Replayable ops

| Op                         | Randomizing | Source                                 |
| -------------------------- | ----------- | -------------------------------------- |
| Random sort (all, by show) | Yes         | `useRandomSort.ts`                     |
| Block / cyclic shuffle     | Yes         | `blockShuffle` in `useBlockShuffle.ts` |
| Replicate (random)         | Yes         | `replicatePrograms`                    |
| Add breaks                 | Yes         | `addBreaks`                            |
| Pad start times            | No          | `padStartTimes`                        |
| Restrict hours             | No          | `restrictHours`                        |
| Remove flex                | No          | `useRemoveFlex.ts`                     |

### Edits after the first randomizing op

- Adding or removing programs applies the same change to `base` and keeps the recipe.
- A drag reorder, a single-item move, or any op not in the table drops the recipe. The UI shows
  that the toggle turned off and why.

### Work

1. Move the op functions in the table from `web/src/hooks/programming_controls/` to
   `@tunarr/shared`, with the RNG passed in (`random-js` `Random`). The web hooks become thin
   wrappers that pass an unseeded engine.
2. Record ops in the channel editor store and maintain `base` according to the rules above.
3. Add optional `recipe`, plus `rebuildEachLoop`, to `ManualProgramLineupSchema`. Store the recipe,
   seed and skip count in the lineup JSON. A manual save without a recipe clears them.
4. On the server, materialize `base` to `ChannelProgram` (the same path `MaterializeLineupCommand`
   uses), run the ops, condense the result, and hand it to the boundary service.

### Why manual is simpler than slots in one way

A manual loop plays each base item once per pass. There is no iterator position to carry between
loops, so the ordered-show continuity problem does not exist here.

### Risks to verify

- Each op must work on server-materialized programs. Shuffle by show and block shuffle group by
  show, and the sorts need season, episode and release date. Confirm materialization fills those
  fields.
- Programs deleted since the save drop out of `base` at replay. Programs added to the library do
  not appear, because a manual lineup has no source query.
- Restrict hours and pad start times depend on the loop's start time. Replay them with the new loop
  start, not the original channel `startTime`.

### Size

Medium to large. Most of the cost is moving the functions and their tests to `shared` and building
the op-log plumbing in the editor store. Phase 2 does not block v2 if it stays limited to the
table above.

## Open questions

1. Should "Rebuild each loop" default to on for new slot channels and stay off for existing ones?
2. Should shuffled slots persist their played-this-pass IDs in phase 1, or wait for complaints?
3. In phase 2, should a drag reorder after a shuffle drop the recipe, or fold the reorder into
   `base`? Dropping it is simpler and easier to explain.
