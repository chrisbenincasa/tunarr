# Scheduling and Lineups

*Last Updated: 2026-11-22*

Domain terms (slot, lineup, filler, flex) are defined in `CONTEXT.md` at the repo root.

## Where a lineup lives

A channel's lineup is **not** in SQLite. `server/src/db/channel/LineupRepository.ts` stores it as
a lowdb JSON file at `<databaseDirectory>/channel-lineups/<channelId>.json`. The file holds the
item list, the schedule definition, and on-demand state. Channel rows and program rows stay in
SQLite. `db/channel/BasicChannelRepository.ts` creates the lineup file when it creates a channel.

Lineup file format changes are migrated by `server/src/migration/lineups/ChannelLineupMigrator.ts`,
separately from SQL migrations.

## Lineup durations and channel position

- Each lineup item stores its own `durationMs`, a copy of `program.duration`. Streaming and the guide
  read the copy.
- A channel's position is `(now - channel.startTime) % channel.duration`; on-demand channels use the
  lineup's `onDemandConfig.cursor` instead.
- `server/src/tasks/ReconcileProgramDurationsTask.ts` copies changed program durations into lineups.
  `MediaSourceScanCoordinator` runs it after every scan.
- A slot lineup with a stored `scheduleSeed` is rebuilt by `RegenerateChannelLineupCommand` instead.
  The command replays the seed from the channel's `startTime`, so time slots stay on the clock and
  shuffles repeat. New or changed programs in a slot can still change what airs. For a lineup with
  `rebuildEachCycle` on, the command delegates to `SlotCycleBoundaryService.regenerateChannel`
  instead, which rebuilds everything after the program on air (see "Cycles" below).
- Slot saves write `scheduleSeed` to the lineup file; manual saves clear it, along with the cycle
  fields described below. Lineups saved before the field existed have no seed and are patched
  until the next slot save or regeneration.
- The patch rules live in `server/src/db/lineupDurationReconciler.ts`. Flex right after a changed item
  absorbs the difference; mid-roll segments are clamped, or the final one is extended; a dropped segment
  takes the mid-roll break before it along. The current position is kept by moving the on-demand
  cursor, or by rebasing `startTime` to the nearest minute, which can shift it by up to 30 s.
- `BasicChannelRepository.updateChannel` never writes `duration`, and it rounds every `startTime` down
  to the minute.

## Schedulers (`server/src/services/scheduling/`)

| Kind | Files |
|------|-------|
| Time slots | `TimeSlotSchedulerService.ts`, `TimeSlotService.ts`, `TimeSlotImpl.ts` |
| Random slots | `RandomSlotSchedulerService.ts`, `RandomSlotsService.ts`, `RandomSlotImpl.ts` |
| Shared | `SlotImpl.ts`, `SlotSchedulerHelper.ts`, `slotSchedulerUtil.ts`, `slotGroupValidator.ts`, `slotIteratorState.ts` |
| Filler and breaks | `FillerPickerV2.ts`, `WeightedFillerProgramIterator.ts`, `midRollBreakRules.ts` |

Program iterators decide the order within a slot: `ProgramOrdereredIterator.ts` (sic),
`ShuffleProgramIterator.ts`, `ProgramChunkedShuffle.ts`, `StaticProgramIterator.ts`,
`FlexProgramIterator.ts`.

## Strict saves, lenient rebuilds

- Slot schedules reference filler lists, custom shows, shows, smart collections, and redirect
  channels by ID. Deleting any of them never rewrites schedules, so a saved schedule can hold an ID
  that no longer resolves.
- User saves (`channelsApi.ts` and `LineupRepository`'s lineup update) set `strictValidation: true`.
  `SlotSchedulerHelper.assertSlotReferences` then rejects the whole save with
  `ScheduleValidationError` (HTTP 400) for a deleted reference or an empty custom show. An empty filler
  list passes.
- Background rebuilds (`RegenerateChannelLineupCommand`) leave the flag off. A slot that resolves to
  nothing is skipped and plays flex. Redirect slots are the exception, because they still emit
  redirect items to a deleted channel (#2486).
- The web slot editors mirror the strict check so the user fixes a dangling reference before saving.
  The helpers live in `web/src/helpers/slotSchedulerUtil.ts` (`customShowAvailability()`,
  `unavailableCustomShowSlotIndexes()`).

## Resuming a build

- `slotIteratorState.ts` defines `SlotIteratorState`, where each iterator left off. Ordered and
  `ordered_shuffle` iterators store the last program played; shuffle iterators store the programs
  played in the current pass. All-rerun link groups store how many slots have aired the current
  program (`rerunPlays`). Mixed link groups store the programs their rerun slots have yet to replay
  (`periodPlays`). Random slots also store the next sequential slot and cooldown times.
- `createSlotIterators` keys iterators by slot position (`slot:<n>`) or link group (`group:<id>`).
  `assignIteratorKeys` returns the same keys without building iterators.
- `scheduleTimeSlots` and `RandomSlotScheduler.generateSchedule` take optional
  `{ iteratorState, endTime, checkpoints }` and return `iteratorState` next to `discardCount`. `endTime` replaces
  the `maxDays` limit. Time slots check it only when a slot starts, so the slot it falls in fills
  its whole window. With no state passed, output is unchanged.
- `checkpoints: true` records the state at every point the scheduler can restart from (each slot
  start, or each random-slot cursor advance), stored as changes from the previous one
  (`slotCheckpoints.ts`, `stateAtCheckpoint`).
- A time-slot build measures DST from the start of the period it starts in, so a mid-period start
  lays slots out like a build from the period start.
- The worker request and reply schemas (`server/src/types/worker_schemas.ts`) carry both fields.

## Cycles

Opt-in reshuffle-on-loop for slot channels (design in `plans/schedules-reshuffle-on-loop.md`).

- A lineup with `rebuildEachCycle: true` holds one cycle's worth of content at a time and the
  server extends it as time passes, instead of building the whole schedule up front.
- A cycle is a chunk of `programmingHours`, capped at 24 h (`chunkLengthMs`).
- The lineup JSON carries three extra fields: `rebuildEachCycle`, `cycles` (each cycle's item
  count, duration, start snapshot, and checkpoints), and `nextCycleSnapshot` (the end snapshot of the last
  built cycle). All three are optional, so no `ChannelLineupMigrator` step was needed.
- `server/src/services/scheduling/slotCycles.ts` holds the pure cycle math: `chunkLengthMs`,
  `cycleStartTime` (start of day for time slots, the minute for random slots), `initializeCycles`,
  `advanceCycles`, and the cut-over trio `firstRestartAfterAiring`, `truncateAt`,
  `rebuildAfterAiring`. A cut-over keeps everything before the first restart point after the
  program on air and builds from the state recorded there.
- `server/src/services/scheduling/SlotCycleBoundaryService.ts` is the stateful layer. It builds
  ahead to the `xmlTvSettings().programmingHours` horizon, trims cycles that have fully aired
  (writing `channel.startTime` exactly), and catches up after downtime from the last snapshot.
  `regenerateChannel` cuts over after the program on air. `applyScheduleEdit`, called by the slot
  save in `channelsApi.ts` with the lineup from before the save, does the same on the edited
  schedule. `slotIteratorRemap.ts` moves each slot's state to the edited slot with the same
  content, order, direction and season filters.
- `EmptyTrashService` and `DeleteMediaSourceCommand` regenerate each rebuilding channel that
  `removeProgramsFromAllLineups` changed (it returns their IDs).
  `server/src/commands/BuildSlotCycleCommand.ts` builds one cycle through the worker pool without
  writing anything.
- `server/src/tasks/SlotCycleBoundaryTask.ts` runs `advanceAll` on a schedule (every 5 minutes,
  plus once at startup) over every channel with `rebuildEachCycle` on. The startup run is also the
  catch-up: catch-up triggers on state (all built content has aired), not on a separate flag.
- `server/src/services/ChannelLineupLock.ts` is a reentrant per-channel lock, shared with
  `OnDemandChannelService`. Every single-channel lineup read-modify-write runs inside it: the
  slot/manual save API, `RegenerateChannelLineupCommand`, `ReconcileProgramDurationsTask`, and the
  boundary service. Reentrancy lets a caller already holding the lock (e.g. the reconciler) call
  into another lock-taking operation (e.g. regenerate) without deadlocking.
- Save rules: a slot save keeps `rebuildEachCycle` at its request value, falling back to the
  lineup's existing value, falling back to off — the server never defaults it on, since slice 4's
  web toggle doesn't exist yet. Every slot save assigns a new `scheduleSeed` and clears `cycles`.
  Turning it on writes `startTime` to `cycleStartTime(now)` exactly before building the first
  cycle. On a channel already rebuilding, `applyScheduleEdit` keeps `startTime` and the program on
  air. A manual
  save clears `rebuildEachCycle`, `cycles`, and `nextCycleSnapshot`.
- Lineups with `onDemandConfig` never rebuild. `PUT /channels/:id` takes the lock and ignores an
  incoming `startTime` on rebuilding channels, because the server owns it. Each pass builds a capped
  number of cycles, and every cycle write also syncs `channel_programs`.

## Related

- `server/src/commands/MaterializeLineupCommand.ts` and `RegenerateChannelLineupCommand.ts` expand
  or rebuild a lineup.
- `server/src/stream/StreamProgramCalculator.ts` reads the lineup to decide what is playing now.
- `server/src/services/TvGuideService.ts` reads lineups to build the guide.
- Web slot editors live under `web/src/components/` and the `channels_` routes.
