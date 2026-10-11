# Scheduling and Lineups

*Last Updated: 2026-10-09*

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
  shuffles repeat. New or changed programs in a slot can still change what airs.
- Slot saves write `scheduleSeed` to the lineup file; manual saves clear it. Lineups saved before the
  field existed have no seed and are patched until the next slot save or regeneration.
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
| Shared | `SlotImpl.ts`, `SlotSchedulerHelper.ts`, `slotSchedulerUtil.ts`, `slotGroupValidator.ts` |
| Filler and breaks | `FillerPickerV2.ts`, `WeightedFillerProgramIterator.ts`, `midRollBreakRules.ts` |

Program iterators decide the order within a slot: `ProgramOrdereredIterator.ts` (sic),
`ShuffleProgramIterator.ts`, `ProgramChunkedShuffle.ts`, `StaticProgramIterator.ts`,
`FlexProgramIterator.ts`.

## Related

- `server/src/commands/MaterializeLineupCommand.ts` and `RegenerateChannelLineupCommand.ts` expand
  or rebuild a lineup.
- `server/src/stream/StreamProgramCalculator.ts` reads the lineup to decide what is playing now.
- `server/src/services/TvGuideService.ts` reads lineups to build the guide.
- Web slot editors live under `web/src/components/` and the `channels_` routes.
