# Reshuffle on Loop vs. Infinite Schedules: Output Check

> **Status (11/22/2026):** Design check of PR #2312 (slice 3 of #2310) against infinite-schedules
> decisions D10–D12, read at `64c015ae5`. Maintainer chose chunking, with chunks of
> `programmingHours` capped at 24 h, and asked that saves keep each show's place. Reworked on
> `feat/slot-cycle-boundary` the same day (uncommitted). See "Implemented" below. Next step is
> maintainer review.

## Question

Does a rebuilding slot channel air the same timeline an infinite schedule would, given the same
schedule and the same events? The two engines may get there differently. This check compares only
what reaches the guide and the stream.

Sources:

- Infinite: `architecture/infinite-schedules/README.md`, decisions D9–D13
- Reshuffle: `plans/schedules-reshuffle-on-loop.md` and the code on `feat/slot-cycle-boundary`

## Verdict

- Steady state matches. Refill, trim, guide horizon and worker pickup produce the same timeline.
- Edits, library changes and purges diverge. Each one changes airing or aired content that an
  infinite channel would leave alone.
- All three divergences have one cause. The PR saves iterator state only at cycle starts, and a
  time-slot cycle is one `schedule.period`. The nearest saved state can be a day or a week behind
  `now`.
- The rework adds checkpoints at every slot start, so a change can apply from the slot after the
  program on air (D10 with G = 0).
- After the rework, saves keep each unchanged slot's place (D9) and purges are replaced from the
  next slot (D12). Rescans still rewrite the guide after the program on air, where D11 would leave
  it alone.
- Deletes of referenced entities are still not refused (first half of D12). That's classic-wide.

## Where output already matches

| Behavior      | Infinite                               | PR #2312                                                                                                                              | Match |
| ------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Refill        | Resumes from the saved cursor (D11)    | Build-ahead resumes from `nextCycleSnapshot` (`slotCycles.ts` `advanceCycles`)                                                        | Yes   |
| Aired content | Cursor moves past it                   | Trim drops aired cycles and moves `startTime` by their exact length. Position is unchanged                                            | Yes   |
| Guide horizon | Rolling buffer                         | Builds to `now + programmingHours`                                                                                                    | Yes   |
| Worker pickup | Push an invalidation to ETV next (D10) | ETV next `dynamic` mode calls `/api/etv/playout-item` per item, so a change lands at the next item. `materialized` mode has no caller | Yes   |
| Downtime      | Not specified                          | Catch-up from the last end snapshot. Missed cycles are not simulated                                                                  | Open  |

## Divergences

### 1. Edits (D10, with D9)

**Infinite**

- An edit takes effect from the end of the program airing at `now + G`. G defaults to 0.
- Placement edits keep positions. Only an order, direction or content-source change resets (D9).

**PR #2312**

- A slot save calls `SlotCycleBoundaryService.initializeChannel` (`channelsApi.ts:698-707`).
- The save writes a new seed and clears `cycles` and `nextCycleSnapshot`
  (`LineupRepository.ts:1138-1146`).
- The first cycle starts at the current period start for time slots, or at `now` floored to the
  minute for random slots (`slotCycles.ts:94`).

**Output effect**

- The guide rewrites at once, including the airing program and the whole horizon.
- A viewer joins the new timeline partway into whatever program it places at that moment.
- Ordered shows restart at episode 1. Shuffle passes restart.
- There is no lock window, so a save can break DVR recordings booked inside the horizon.

### 2. Library changes (D11)

**Infinite**

- Only an edit or lost content regenerates buffered items.
- New content enters at the refill point.

**PR #2312**

- `ReconcileProgramDurationsTask` regenerates any seeded slot lineup whose program durations
  changed (`ReconcileProgramDurationsTask.ts:166`). A guide-affecting settings change does the same
  (`channelsApi.ts:344`).
- For a rebuilding channel, regeneration runs `cascadeCycles` (`SlotCycleBoundaryService.ts:146`).
  It replays from the airing cycle's start snapshot against the live library
  (`slotCycles.ts:248`).

**Output effect**

- Replay is deterministic, so items match up to the first changed program or duration.
- After that point a changed duration shifts later items. A changed content pool reorders shuffles
  and inserts new episodes into ordered runs.
- The program on air can change, and so can past guide entries in the airing cycle.
- Time slots keep shifts inside slot windows. But a fill slot that fits one fewer episode moves
  that show's later slots.
- Scans fire this on any channel where a duration changed, so DVR recordings break here too.

**Gap in the infinite design:** D11 does not say what happens to buffered items whose program
duration changed. Classic patches or regenerates. Infinite needs its own decision.

### 3. Lost content (D12)

**Infinite**

- A delete of a custom show, filler list, smart collection or redirect target that slots use is
  refused until the caller picks a mode.
- A media-server purge marks the slot broken.
- A purged program already in the buffer regenerates the timeline from that item at once,
  ignoring G.

**PR #2312**

- Empty trash rewrites purged programs as flex of the same length
  (`EmptyTrashService.ts:165` → `LineupRepository.ts:512`). Built cycles keep the hole until they
  are trimmed. Later cycles skip the program because the library no longer has it.
- Deletes of referenced entities go through, as in all classic schedules. The next cycle build
  skips that slot and plays flex. Redirect slots still emit redirects to a deleted channel (#2486).
  The user's next slot save fails strict validation.

**Output effect**

- Purged programs leave flex holes where infinite would air replacement content.
- A slot whose source was deleted airs flex for whole cycles, with no prompt.

## Root cause

The PR keeps a snapshot only at each cycle start. To apply any change, it has two choices. It can
replay from the airing cycle's start (regenerate), or it can drop all state and start over (save).
Both touch content at or before `now`. Infinite keeps a cursor at the buffer end, so it can apply a
change from a point at or after the airing program.

## Implemented

| Change                                                                                                                         | Closes                           |
| ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Chunks of `programmingHours`, capped at 24 h (`chunkLengthMs`)                                                                 | Precondition                     |
| Checkpoints at every scheduler restart point, stored as changes from the one before (`slotCheckpoints.ts`)                     | Exact state after `now`          |
| A save keeps everything up to the first restart point after the program on air, then builds the edited schedule from there     | D10 with G = 0                   |
| A save carries each slot's place to a slot with the same content, order, direction and season filters (`slotIteratorRemap.ts`) | D9, mostly                       |
| A rescan or guide-settings change rebuilds from the same restart point, with the state recorded there                          | D11, see notes                   |
| Empty trash and media source deletes rebuild each rebuilding channel that lost a program                                       | D12 purge, from the next program |
| Mixed link group recordings join the snapshot (`periodPlays`), so a rerun slot after a restart replays what it should          | Bug found during the rework      |
| Mid-period builds measure DST from the period start                                                                            | Bug found during the rework      |

Notes:

- The restart point after the program on air is usually the next slot start, at most one slot away.
  A cycle start or the end of the built content also counts.
- A restored shuffle reshuffles the rest of its pass, and filler weights start over. So after a
  rebuild, shuffles and filler can pick different items than the old guide showed, though no show
  loses its place and no shuffle repeats early. Storing shuffle orders and filler state would make
  rebuilds exact. That's deferred.
- A rescan still rewrites the guide after the program on air. D11 would leave buffered items alone.
- A purged program before the restart point stays flex. That's at most the rest of one slot.
- Programs in the kept part keep their old durations until they air.

## Chunk length

Chunks match `programmingHours` (XMLTV setting, default 12 h), capped at 24 h.

- No new setting. Build-ahead adds one chunk per pass, and the lineup holds about two chunks.
- Saves, rescans and purges cut over at checkpoints, so chunk length no longer bounds their delay.
- The cap bounds how much one build does, and how much a catch-up builds to reach `now`.
- Changing `programmingHours` changes only future chunks. Built chunks keep their recorded lengths.

## Accepted divergences

- Changes cut over after the program on air. G is fixed at 0 and is not configurable.
- Edits that change a slot's content, order, direction or season filters restart that slot. That
  matches D9. A slot's place does not follow it across a content change.
- Shuffle and filler picks after a rebuild can differ from the old guide.
- Rescans rewrite the guide after the program on air.
- Deletes of referenced entities are not refused. This is classic-wide, and slice 6 handles it for
  infinite.

## Open questions

- Infinite: what happens to buffered items whose program duration changed?
- Infinite: what happens after downtime? The PR's catch-up rule is a candidate to adopt.
- Store shuffle orders and filler state in snapshots, so rebuilds reproduce the old guide exactly?
