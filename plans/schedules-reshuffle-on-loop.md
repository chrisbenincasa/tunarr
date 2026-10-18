# Reshuffle Schedules on Loop

> **Status (10/13/2026):** Design settled in a review session. Phase 1 (slot schedules) is ready to
> build once #2306 lands. Phase 2 (manual lineups) is deferred. Nothing implemented.

Stopgap for dynamic schedules (Tunarr v2). A slot channel's lineup holds one cycle of content at a
time. Before a cycle ends, the server builds the next one from the same schedule, continuing the RNG
stream and each iterator's state. Users get a fresh shuffle every cycle without waiting for v2.

## Goals

- Slot channels (time and random slots) get a new shuffle every cycle.
- Ordered shows continue where they left off instead of restarting each cycle.
- Shuffled shows play every program once before repeating, across cycles.
- The guide and XMLTV show the next cycle before it airs.
- Code stays small and isolated, so v2 can replace it without a migration story.

## Non-goals

- On-demand channels. Their position comes from `onDemandConfig.cursor`, not `startTime`.
- Manual lineups (deferred, see Phase 2).
- Custom show editors (`useCustomShowBlockShuffle`, `useCustomShowRandomSort`).
- Replaying cycles missed while the server was down.

## Prerequisites

| Item                                                                        | State                     |
| --------------------------------------------------------------------------- | ------------------------- |
| #2301: seeded RNG for `ordered_shuffle` and random slot picks (fixes #2303) | Merged 10/13/2026         |
| #2306: a settings save reverts a server-moved `startTime`                   | Open. Fix on `main` first |

#2306 fix:

- The settings form sends `startTime` only when the picker is dirty.
- `startTime` is optional on `PUT /channels/:id`. A missing value means unchanged.
- The server rounds user-entered values down to the minute and writes server-computed values exactly.
- The reconciler can then rebase `startTime` exactly instead of to the nearest minute.

## Current state

| Piece                           | Where                                                                                       | State                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Slot schedule definition        | lineup JSON (`LineupRepository.ts`)                                                         | Stored                                                                         |
| `scheduleSeed`                  | lineup JSON                                                                                 | Stored on slot save, cleared on manual save                                    |
| RNG skip count (`discardCount`) | `TimeSlotService.ts`, `RandomSlotsService.ts`                                               | Accepted and returned by the schedulers, never stored                          |
| Lineup length                   | `upperLimit = t0 + maxDays + 1 day` (`TimeSlotService.ts:181`, `RandomSlotsService.ts:242`) | `maxDays` defaults to 365                                                      |
| Rebuild from schedule           | `RegenerateChannelLineupCommand.ts`                                                         | Replays seed from `startTime`. Runs after scans and some property changes      |
| Slot iterator position          | `ProgramIterator.ts`                                                                        | In memory only, starts at 0 every build                                        |
| Channel position                | `(now - startTime) % duration`                                                              | Read per program by `StreamProgramCalculator`. No session holds a lineup index |

## Cycles

### Length

| Schedule     | Cycle                                                            |
| ------------ | ---------------------------------------------------------------- |
| Time slots   | One `schedule.period` (day, week or month). `maxDays` is ignored |
| Random slots | `maxDays`                                                        |

- A cycle ends where its last program ends, so lengths vary and are not whole minutes.
- Each cycle starts exactly where the previous one ended.
- Each time-slot cycle is generated from its own `t0`, so DST is handled per cycle.

### Build ahead

- A `ScheduledTask` runs every few minutes over channels with the toggle on.
- When built content ends less than `xmlTvSettings().programmingHours` from now, it builds cycles
  one at a time until the content reaches past `now + programmingHours`.
- A cycle shorter than the horizon means more than one cycle is built ahead.
- Building appends items. `channel.duration` becomes the sum of all built cycles. `startTime` does
  not move, so the channel position is unchanged.
- After each write it calls `tvGuideService.updateCachedChannel(channelId, true)`.

### Trim

- Once `now` passes the end of the oldest cycle, the task drops that cycle's items and adds its
  duration to `startTime`. The position is unchanged.
- `startTime` is written exactly, with no rounding. This depends on #2306.

### Per-cycle state

Each cycle stores a snapshot of the state it started from:

- `discardCount`, the RNG skip count into the channel's `scheduleSeed`.
- Ordered iterators: `lastProgramId`, plus the rotation offset for `ordered_shuffle`.
- Shuffle iterators: the IDs played in the current pass.

One seed per channel, with skip counts, keeps every cycle reproducible from the channel's seed.

### Rebuilds cascade

- `RegenerateChannelLineupCommand` replays the airing cycle from its snapshot, then rebuilds every
  built-ahead cycle from the new end state. One write.
- Slot lineups with a seed are already regenerated, not patched, by `ReconcileProgramDurationsTask`,
  so the reconciler's patch rules never touch these lineups.

### Catch-up after downtime

- While the server is down past a boundary, the old cycles wrap and replay until the task runs.
- The task runs once at startup. It starts a new cycle from the last aired cycle's end snapshot.
- Time slots: the new cycle starts at the start of the current period.
- Random slots: the new cycle starts at `now`, rounded to the minute.
- Missed cycles are not simulated, so no unaired episodes are skipped.

## Phase 1: slot schedules

### Data (lineup JSON, all optional)

- `rebuildEachCycle: boolean`. Missing reads as off.
- `cycles: Array<{ itemCount, durationMs, snapshot }>`, in lineup order.

New optional fields need no `ChannelLineupMigrator` step.

### Scheduler changes

- `scheduleTimeSlots` and the random-slots equivalent accept a snapshot and a cycle end, and return
  the end snapshot next to the items.
- Ordered iterators resume just after `lastProgramId` in sort order. A missing program means
  starting at 0.
- `ordered_shuffle` resumes at its stored rotation offset.
- Shuffle iterators shuffle only unplayed programs. When those run out, a new pass starts. New
  library programs join the unplayed pool, and deleted ones drop out.

### Regeneration

- `RegenerateChannelLineupCommand`, or a sibling command, builds one cycle from a start time and a
  snapshot, and returns items plus the end snapshot without saving.
- The boundary service owns build-ahead, trim, cascade and catch-up writes.

### Opt-in

- Toggle label: "Rebuild each cycle".
- On by default for new slot schedules. Existing slot channels stay off until the owner turns it on.
- Helper text says that shuffles change each cycle, ordered shows continue, and time slots ignore
  `maxDays`.
- A slot save keeps the toggle state and resets seed, cycles, snapshots and `startTime`.
- A manual save clears the toggle and all cycle state. The saved items become a fixed manual lineup.

### Web

- Add the toggle to both slot editors.
- Make the "Programming Start" picker read-only on rebuilding channels, with helper text saying the
  schedule sets it each cycle. A slot save is the way to restart the schedule.
- Optional: "rebuilt N times, next rebuild at T" on the channel page.

### Tests

- Build ahead and trim keep the channel position unchanged at every step.
- A cycle shorter than the horizon builds enough cycles to cover it.
- Cascade: rebuilding the airing cycle rebuilds the next one from the new end state.
- Ordered shows continue across cycles. `ordered_shuffle` keeps its offset.
- Shuffled programs do not repeat within a pass across cycles.
- Catch-up starts from the last snapshot at the period start (time slots) or `now` (random slots).
- Same seed and library give the same sequence of cycles.

### Size

Medium. The scheduler and iterator plumbing is mechanical. The boundary service and its tests carry
most of the risk.

## Phase 2: manual lineups (deferred)

Deferred on 10/13/2026. It costs about as much as phase 1 and builds editor-store plumbing that
infinite schedules will replace. Revisit if manual-lineup users ask for reshuffles after phase 1
ships. The design below is kept as it was.

### Problem

A manual lineup is a list the browser already shuffled. To reshuffle it, the server needs the list
before the shuffle and the operations applied after it.

### Recipe

When the user saves, the web client sends an optional recipe with the manual lineup.

- `base`, the item list as it stood just before the first randomizing op since the last load.
  Deterministic ops before that point are already baked into `base`, so they never replay.
- `ops`, an ordered list of `{ kind, config }` from the first randomizing op onward.

The server keeps the user's saved items as cycle 1. From cycle 2 on, it replays the recipe with its
own seeded RNG. Because cycle 1 is what the user saw, the browser and server never need to produce
identical shuffles.

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
   `@tunarr/shared`, with the RNG passed in (`random-js` `Random`).
2. Record ops in the channel editor store and maintain `base` according to the rules above.
3. Add optional `recipe`, plus `rebuildEachCycle`, to `ManualProgramLineupSchema`.
4. On the server, materialize `base` to `ChannelProgram`, run the ops, condense the result, and hand
   it to the boundary service.

### Risks to verify

- Shuffle by show and block shuffle group by show, and the sorts need season, episode and release
  date. Confirm materialization fills those fields.
- Programs deleted since the save drop out of `base` at replay. New library programs do not appear.
- Restrict hours and pad start times must replay with the new cycle start.
