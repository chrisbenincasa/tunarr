# Dynamic schedules

Record of the dynamic schedules feature (code name "infinite schedules"). It covers where development stands, the settled design decisions, and the plan to land the feature.

- **Last updated:** 2026-09-13
- **Source PR:** #1927. Not mergeable. Kept as reference only
- **Design review:** [01-design-review.md](./01-design-review.md)

## Summary

- The runtime model is right. Each channel keeps a rolling buffer of generated items plus saved per-channel state, so the guide and the stream read one timeline.
- PR #1927 can't land as it stands.
  - The June 2026 squash-rebase damaged it.
  - Design bugs from before the rebase mean dynamic channels never stream.
- The clean source to port from is `4ca4b75d` (2026-04-30).
- The plan is nine slices behind a feature flag. The tracker is below.

## Settled decisions

| # | Decision | Consequence |
|---|---|---|
| D1 | Two engines stay separate. "Classic" covers manual lineups, time slots and random slots. "Dynamic" is the new engine | The planners don't merge. Shared building blocks go into classic code, so a fix reaches both engines (slice 1) |
| D2 | A channel has exactly one lineup mode, classic or dynamic | The mode is an explicit column. A dynamic channel never falls back to its classic lineup. Every lineup consumer dispatches on the mode |
| D3 | Anchored slots take the same fill modes as any other slot | `fill` runs until the next anchor. `count` and `duration` play exactly that much, then the floating slots resume. The current code caps an anchored `fill` at one program, so that cap is now a bug |

## Open decisions

| # | Question | Recommendation | Blocks |
|---|---|---|---|
| Q1 | Rename "infinite" to "dynamic" in code, tables and API? | Yes. The migration has to be regenerated anyway, so the rename is cheapest now | 2 |
| Q2 | What does `fill` do when no anchor follows? Today a floating `fill` slot rotates after one program | Decide with D3 in mind | 3 |
| Q3 | How should hard, soft and padded anchors behave, and is there a lateness tolerance? The spec and the code disagree | Write the rule down before porting the planner | 3 |
| Q4 | When a channel switches from classic to dynamic, does its classic lineup stay dormant or get cleared? | Keep it dormant so switching back works | 2, 7 |
| Q5 | When a slot is edited, does it keep its iterator state? | Diff slots by UUID, keep state for unchanged slots, and regenerate from now plus a grace period | 4 |
| Q6 | Does a buffer refill resume from the saved cursor, or delete everything after now? | Resume, so items already shown in guides stay put | 4 |
| Q7 | What happens when content a slot references is deleted or purged? | Show the slot as broken. Don't silently delete it | 2, 4 |
| Q8 | Store an IANA zone instead of a minute offset? | Yes | 2 |
| Q9 | Is mid-roll in v1? | Add the start-offset column in the first migration either way | 2 |
| Q10 | Port or abandon the local branch `tanstack-form-rewrite-infinite-schedules`? | Author's call | 7 |

## Where development stands

State at PR head `9eeafa1e`:

| Area | State |
|---|---|
| Schema and DB | 5 tables with CRUD and a state upsert. The migration chain is corrupt, writes aren't transactional, and cascades delete slots |
| Planner | Ordered and shuffle modes, anchors, fill modes, filler with 4 playback modes, and saved state all exist. Flex slots advance time 1 ms at a time, resuming from saved state has bugs, and the tests don't compile against the class |
| Guide | Reads generated items and refills the buffer lazily inside the guide build. Each refill overlaps the existing buffer |
| Stream | Looks up generated items by the wrong key, so it always falls back to the classic lineup |
| API | About 17 routes in two overlapping route families. Slot delete returns 501, and a redirect slot makes the schedule endpoints return 500 |
| Background buffer task | Not started |
| Web | Schedule list, edit and slot pages, a preview, and a channel viewer all exist. The build is broken, nothing can assign a schedule to a channel, and the filler tab edits the wrong field |
| Mid-roll, filler profiles, shareable templates | Not started |

## Plan

- Port from `4ca4b75d`, not `9eeafa1e`.
- Keep dynamic mode behind a feature flag until slice 7 lands.
- Generate the migration last, just before slice 2 merges.
- Blocker IDs (B1–B10) refer to [01-design-review.md](./01-design-review.md#blockers).

| Slice | Contents | Resolves | Depends on | Status | Tracking |
|---|---|---|---|---|---|
| 0 | Settle Q1–Q10. Replace the March spec with this record | — | — | In progress | — |
| 1 | Shared building blocks in classic code, with no classic behavior change: serializable content iterators, season filter, filler selection | Parity bugs (shuffle wrap, season 0, cooldown) | 0 | Not started | — |
| 2 | Schema and DB: lineup mode column, tables, IANA zone, `end_time_ms`, start offset, FKs and indexes, unique `(channel, sequence)`, transactional writes, slot diffing | B5, B9 | 0 | Not started | — |
| 3 | Dynamic planner ported onto slice 1: anchor semantics per D3, correct resume, one shared path for ordered and shuffle modes, test suite restored | B3, B7 | 1, 2 | Not started | — |
| 4 | Generation service: background buffer task, per-channel lock, one transaction per run, invalidation on edit, program lifecycle consumer | B2 | 3 | Not started | — |
| 5 | Runtime readers: lineup-mode dispatch, one timeline read by guide and stream, stream safeguards, remaining lineup consumers | B1 | 4 | Not started | — |
| 6 | API: one `/schedules` route family plus assignment, controller pattern, server-minted IDs, validation on every write | — | 2 | Not started | — |
| 7 | Web: schedule pages, lineup-mode switch and assignment, dynamic filler panel with playback modes, zod-driven forms, slot delete and reorder, preview of unsaved edits | B6, B8, B10 | 6 | Not started | — |
| 8 | Mid-roll, filler profiles, shareable templates | — | 5, 7 | Not started | — |

### Rules for every slice

- Classic behavior changes only in slice 1 and the separate fixes below.
- Dynamic types get their own names. The shared `SlotFiller` stays untouched, which avoids B4.
- No new `ServerContext` fields. New routes use the controller and `mount` pattern.
- Regenerate generated files (OpenAPI spec, web client, route tree, Drizzle meta). Never hand-merge them.

### Separate fixes

- The `ProgramSearchAutocomplete` React key fix goes to `main`.
- The `SlotSchedulerHelper` dedup fix gets its own tested PR, because it changes classic lineups.

## Prior plans

These are the author's local plans in `~/Code/plans/`.

| Plan | Status |
|---|---|
| `infinite-schedules-feature-spec.md` (Mar) | Superseded by this record. Its "37 passing tests" and "full filler UI" claims no longer hold |
| `misty-crafting-codd.md` (filler in planner) | Landed |
| `keen-juggling-conway.md` (filler playback modes) | Backend landed. The UI exists at `4ca4b75d` but was lost at `9eeafa1e` |
| `witty-mixing-toast.md` (filler materialization) | Option A landed |
| `sequential-pondering-peacock.md` (guide integration) | Landed. It assumes `generate()` resumes from the cursor, which is false and causes B2 |
| `mid-roll-infinite-slots.md` | Not started |
| `filler-profiles-feature.md` | Not started |
| `shareable-schedules.md` | Not started. Per D1, it should target dynamic schedules only |

## How to resume

- Settle the open decisions with the author before slices 1–3 start.
- Read [01-design-review.md](./01-design-review.md) for the evidence behind each blocker and finding. Line numbers refer to commit `9eeafa1e` unless marked otherwise.
- Update the Status and Tracking columns as slices open PRs.
