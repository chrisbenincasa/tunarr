# Scheduling and Lineups

*Last Updated: 2026-09-29*

Domain terms (slot, lineup, filler, flex) are defined in `CONTEXT.md` at the repo root.

## Where a lineup lives

A channel's lineup is **not** in SQLite. `server/src/db/channel/LineupRepository.ts` stores it as
a lowdb JSON file at `<databaseDirectory>/channel-lineups/<channelId>.json`. The file holds the
item list, the schedule definition, and on-demand state. Channel rows and program rows stay in
SQLite. `db/channel/BasicChannelRepository.ts` creates the lineup file when it creates a channel.

Lineup file format changes are migrated by `server/src/migration/lineups/ChannelLineupMigrator.ts`,
separately from SQL migrations.

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
