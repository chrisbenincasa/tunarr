# Remove movie slots

## Why

A `movie` slot has no source of its own. Its pool is every `movie`,
`music_video` and `other_video` program the scheduler is handed: the channel's
saved programs plus everything pulled in from the schedule's filler lists,
custom shows, smart collections and shows. A filler list of commercials attached
to any slot therefore lets the movie slot schedule those commercials as
programs. Working around the pool's semantics is a losing game, so movie slots
go away. Users schedule movies by putting them in a custom show and scheduling
that, which supports mid-roll breaks as of #2213.

## Status

- 10/07/2026: Step 1 (migration) committed on `fix/remove-movie-slots`
  (`c73f5f6d5`). Step 2 (removal) done in the working tree, uncommitted.
  Typecheck, lint, server and web tests pass. Next: commit, then step 3.
- Open decisions resolved 10/07/2026: all three proposals accepted.
- Prerequisite #2213 (mid-roll breaks on custom-show slots) is merged.
- Custom show sort follow-ups merged as #2214.
- Interim fix PR #2234 (`fix/movie-slot-filler-leak`) closed unmerged in favor
  of this removal.

## 1. Migration: lineup schema v6 to v7

`MovieSlotToCustomShowMigration` in `server/src/migration/lineups/`, registered
in `ChannelLineupMigrator`'s `MigrationSteps`. Bump `CurrentLineupSchemaVersion`
to 7.

**Interface.** `ChannelLineupMigration.migrate(schema)` gets an optional second
argument, `{ channelId }`, passed by `ChannelLineupMigrator.runSingle`.
Existing migrations ignore it.

**What goes into the show.** The channel's saved programs
(`getChannelAndPrograms`) of type `movie`, `music_video` or `other_video`, minus:

- programs that appear in the lineup only as filler (content items with a
  `fillerListId` or `fillerType`)
- programs in a filler list the schedule uses (slot filler or filler slots),
  which drops commercials that already leaked into a saved lineup

This is narrower than today's pool, which also takes movies from custom shows,
smart collections and shows the schedule references. Those are left out.

**Snapshot, not live.** A movie slot picks up movies added to the channel later.
The custom show is fixed at migration time. Release notes and docs must say so.

**One show per distinct sort.** Usually one per channel.

| Movie slot order        | Show built in                      | Custom-show slot order |
| ----------------------- | ---------------------------------- | ---------------------- |
| `next`, `chronological` | air date, in the slot's direction  | `next`                 |
| `alphanumeric`          | title, in the slot's direction     | `next`                 |
| `ordered_shuffle`       | air date, in the slot's direction  | `ordered_shuffle`      |
| `shuffle`               | any show already built, else air date ascending | `shuffle` |

Sort with the scheduler's own orderers (`getProgramOrderer`) so the order
matches what the movie slot produced. Custom-show slots ignore `direction`, so
the direction has to be baked into the show.

Shows are named `<Channel> Movies`, with a sort suffix only when a channel
needs more than one. Iterators are keyed by slot ID, so each ungrouped slot
gets its own iterator before and after the migration. Only slots with an
`iterationGroup` share one, and the migration keeps that field.

**The slot keeps everything else:** id, filler, mid-roll, weight, cooldown,
duration spec, start time and links. Only `type`, `customShowId`, `order` and
`direction` change. `direction` becomes `asc` because the show already holds
the slot's direction, and a later change that honors `direction` on
custom-show slots would otherwise reverse it a second time.

**Empty pool.** The slot becomes a `flex` slot and the migration logs a
warning. An empty custom show would fail schedule validation on save.

**Reruns.** If the migration fails after creating a show, the lineup stays on
v6 and the migration runs again on the next startup. Each show's ID is a
uuid v5 of the channel ID and sort key, so the rerun finds the show it created
instead of making a duplicate. Names are not unique, so the migration never
looks a show up by name.

**Tests.** DB-backed, following `server/src/db/CustomShowDB.test.ts`:

- show contents and order for each order and direction
- lineup-only filler and filler-list members are excluded
- slot rewrite keeps every other field
- empty pool becomes flex
- a schedule without movie slots is untouched
- a channel with no schedule is untouched
- the result parses under the new `LineupSchema`
- a rerun reuses the show

## 2. Removal

- **types:** `MovieProgrammingSlotSchema`, `BaseMovieProgrammingSlot`, the time
  and random slot variants, and their union members (`CommonSlots.ts`,
  `TimeSlots.ts`, `RandomSlots.ts`).
- **server:** the `movie` bucket and `ContentSlotId` members in
  `createProgramMap`, the `movie` arm of the slot iterator, the
  `movie_${order}` iterator key and `slotIteratorKey` case, `case 'movie'` arms
  in `RandomSlotsService.validateSchedule` and `SlotSchedulerHelper`. Narrow
  `getContentProgramIterator` to show slots. Tests that build movie slots move
  to show or custom-show slots.
- **web:** slot view models (`CommonSlotModels.ts`, `SlotModels.ts`,
  `TimeSlotModels.ts`), `slotSchedulerUtil.ts` and `slots.ts` helpers, the add
  slot buttons' movie defaults, both edit dialogs, `EditSlotProgrammingForm`,
  `SlotLinkingControl`, `SlotFillerDialogPanel`, `TimeSlotTable`, `useSlotName`,
  `useSlotProgramOptions`, `useScheduledSlotProgramDetails`, and their tests.
  The slot type picker gets a hint pointing to custom shows for movies.
- **docs:** `docs/configure/scheduling/slot-linking.md` and the scheduling
  pages, plus how to schedule movies with a custom show.
- Regenerate the OpenAPI spec and web client. Re-extract translations.

## 3. Rollout

- Merge after #2213, or migrated movie slots with mid-roll lose their breaks.
- The API rejects `movie` slots, so a browser still running the old web app
  gets a validation error when it saves a schedule until it reloads.
- `infinite-schedules` will conflict in `types/src/api/CommonSlots.ts` when it
  rebases.

## Open decisions

1. The migrated show is a snapshot and doesn't follow movies added to the
   channel later. Proposed: accept it, and document it.
2. Rerun safety by deriving each show's ID from the channel and sort. Done.
3. One PR (migration and removal) or two (migration and server, then web).
   Proposed: one, since the web won't compile against the new types without
   the UI changes.

## Follow-ups

Custom show sorting, so users can re-sort a migrated show and schedule it with
`next`. The custom show editor's Tools menu (`CustomShowSortToolsMenu`) has
Random, Release Date, Block Shuffle and Clear All, and the program list
supports drag-and-drop reordering. Gaps:

- **No title sort.** The channel editor has one (`useAlphaSort` /
  `sortPrograms`), but custom shows don't. Add a `Title` entry using the same
  sort, like `useCustomShowReleaseDateSort` does for release date. Without it,
  a migrated `alphanumeric` show can't be re-sorted by title after edits.
- **Release Date label can be wrong.** Picking Release Date from the menu while
  it is already ascending sorts descending but keeps the "(asc)" label
  (`CustomShowSortToolsMenu.tsx`, the menu item's `onClick`).
- **Undated programs sort first, not last, when ascending.** The web orderer
  uses `releaseDate ?? 0`, though the tooltip says undated items move to the
  bottom. The movie slot's orderer treats a missing date as now, so they sorted
  last there.
