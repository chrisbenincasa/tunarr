# Issue #2589: Ordered shuffle slots change episode on every save (rebuild each cycle)

> **Status (11/27/2026):** Reported as #2589. Reproduced on `main` (d6599fa7). Fix and two
> regression tests on `fix/ordered-shuffle-save-place`, also checked by saving twice in the web UI.
> Next: review of the PR.

## Verdict

Real bug. On a channel with **Rebuild each cycle** on, saving the slot schedule again (even with
no changes) changes the upcoming episodes of `ordered_shuffle` slots that have not aired yet.
`next` and `shuffle` slots keep their place.

It is not intended behavior. The design (`plans/schedules-reshuffle-on-loop.md`) says a slot keeps
its place on a save when its content, order, direction and season filters are unchanged.

## Already reported?

Searched issues and PRs in `chrisbenincasa/tunarr` for "ordered shuffle", "ordered_shuffle",
"rebuild each cycle", "chunked shuffle", and read #2303, #2310, #2482, #2545, #2576, #2587 and the
bodies and reviews of #2301, #2311, #2312, #2564, #2567. Nothing describes this case.

- #2303 (closed): ordered shuffle jumped on regenerate because it used an unseeded RNG. Fixed by
  #2301. Different cause.
- #2576 (open): asks for a way to reset a slot's place. Related feature, not this bug.
- #2587 (open): migrating old channels. Unrelated.

## Reproduction

Probe test (deleted after use): a time-slot channel with one custom show, rebuild each cycle on,
saved twice with the same schedule (the UI sends a new seed each save). Compared the next 8
programs after now.

| Order             | 1 slot/day | 4 slots/day                                                        |
| ----------------- | ---------- | ------------------------------------------------------------------ |
| `next`            | same       | same                                                               |
| `shuffle`         | same       | same                                                               |
| `ordered_shuffle` | same       | **differs**: `47,48,49,50,43,44,45,46` → `47,48,49,50,42,43,44,45` |

The slot on air (47–50) is kept. The next slot, which has not aired yet, starts at a different
episode. With the fix all six cases match.

## Root cause

- A save carries each slot's iterator snapshot from the cut point (`slotIteratorRemap.ts`).
- `ordered_shuffle` (`ProgramChunkedShuffle.ts`) starts at a random rotation of the sorted list.
  Its snapshot is `{ type: 'ordered', lastProgramId }`, and `IndexBasedProgramIterator.snapshot()`
  (`ProgramIterator.ts:101`) returns nothing until the iterator has played a program.
- So a slot that has not aired yet carries no state. The save rebuilds it with the new seed and
  `random.integer(...)` picks a new rotation, which means a new starting episode. Each later save
  does the same again while the slot still hasn't aired.
- `shuffle` doesn't have this problem: the stable shuffle snapshot stores its seed even before
  anything plays (`ShuffleProgramIterator.ts:172`). `next` always starts from the first episode.

### How it got in

- #2311 decided that `ordered_shuffle` needs only `lastProgramId`, because a rotation keeps the
  sorted list's cyclic order. That holds once the slot has played something. It skips the case
  where the random start is the slot's only state.
- #2311 and #2312 tested two consecutive builds with the **same** seed, and regenerations reuse the
  stored seed. With the same seed the rotation is drawn again identically, so the gap never showed.
- Only a slot save mints a new seed, and only a slot that has not aired yet has no snapshot. The
  tests used one slot that airs first, or reused the seed.
- The stable shuffle (`shuffle`) was designed later to store its seed up front, so it doesn't have
  the gap.

## Fix

`ProgramChunkedShuffle.snapshot()` falls back to the program before the starting point when nothing
has played yet. Resuming after that program lands on the same start. Tests in
`slotIteratorState.test.ts`:

- `keeps its starting point before it plays anything`: an unplayed iterator's snapshot resumes at
  the same start under five other seeds.
- `an ordered_shuffle slot that has not aired keeps its start under a new seed`: a 00:00 and a 12:00
  slot. After a morning cycle, the afternoon rebuilt with a new seed equals the one planned with the
  old seed.

Both fail on `main` and pass with the fix.

Checked in a dev server with a 12-episode local show and slots at 00:00 (next), 13:00 (ordered
shuffle), 15:00 (next), 17:00 (shuffle) and 19:00 (ordered shuffle), saving twice from the time
slot editor. Without the fix the 13:00 slot started at E05, then E02, then E04, and the 19:00 slot
moved from E11 to E07. With the fix every slot kept its episodes across both saves. All scheduling, command and slot-cycle tests pass (365).
The full server run shows 146 failures in DB, ffmpeg and filesystem tests that fail the same way
without the change (Windows `EBUSY` on the temp database, no ffmpeg).

## Draft issue

**Title:** [Bug]: Saving a "rebuild each cycle" slot schedule changes the episode of ordered shuffle slots that haven't aired yet

With **Rebuild each cycle** on, saving a time-slot schedule keeps the place of `next` and `shuffle`
slots, but `ordered_shuffle` slots that haven't aired yet start from a different episode after every
save, even when nothing in the schedule changed.

Steps: one custom show (or TV show) in 4 daily time slots with order "Ordered shuffle", rebuild each
cycle on. Save, note the guide for the later slots of today, save again without changes. The later
slots now start at a different episode. The slot on air is unchanged.

Cause: an `ordered_shuffle` iterator only writes a snapshot (`lastProgramId`) after it has played a
program. A slot that hasn't aired carries no state, so the save rebuilds it from the new seed and
draws a new random rotation. The stable shuffle stores its seed before playing, so `shuffle` slots
don't have the problem. Tests in #2311/#2312 reused the seed, which redraws the same rotation, so
they didn't catch it.
