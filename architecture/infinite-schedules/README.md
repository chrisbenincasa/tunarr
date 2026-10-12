# Infinite schedules

Record of the infinite schedules feature. It covers where development stands, the settled design decisions, and the plan to land the feature.

- **Last updated:** 2026-10-12
- **Source PR:** #1927. Not mergeable. Kept as reference only
- **Design review:** [01-design-review.md](./01-design-review.md)

## Summary

- The runtime model is right. Each channel keeps a rolling buffer of generated items plus saved per-channel state, so the guide and the stream read one timeline.
- PR #1927 can't land as it stands.
  - The June 2026 squash-rebase damaged it.
  - Design bugs from before the rebase mean infinite channels never stream.
- The clean source to port from is `4ca4b75d` (2026-04-30).
- The plan is eleven slices behind a feature flag, followed by a gated deprecation of time and random slots. The tracker is below.

## Settled decisions

| # | Decision | Consequence |
|---|---|---|
| D1 | Two engines stay separate. "Classic" covers manual lineups, time slots and random slots. "Infinite" is the new engine | The planners don't merge. Shared building blocks go into classic code, so a fix reaches both engines (slice 1) |
| D2 | A channel has exactly one lineup mode, classic or infinite | The mode is an explicit column. An infinite channel never falls back to its classic lineup. Every lineup consumer dispatches on the mode |
| D3 | Anchored slots take the same fill modes as any other slot | `fill` runs until the next anchor. `count` and `duration` play exactly that much, then the floating slots resume. The current code caps an anchored `fill` at one program, so that cap is now a bug |
| D4 | A schedule uses a reusable slot by live reference, not by copy | Editing a reusable slot changes every schedule that uses it and invalidates the buffers of every channel on those schedules. A "detach" action that turns one use into a local copy comes later, in place of per-field overrides |
| D5 | A slot holds content, iteration order, season filter and filler. A placement holds position, anchors, weight, cooldown, linking, fill mode and value, padding and flex preference | The slot row splits into two tables. A slot alone has no length. "One episode at 6 PM, two at 11 PM" is two placements of one slot |
| D6 | A slot is either a library slot or a private slot. Both live in one table. A private slot belongs to one schedule, stays out of the library, and is deleted with the schedule. "Promote" makes it a library slot | The slot table gets an owner column. The planner sees one kind of slot. Detach copies a library slot into a private one |
| D7 | A channel keeps one position per slot, not per placement. Placements of the same slot share it by default. A placement can opt into `rerun` (repeat the slot's most recent program) or `independent` (its own position) | Slot state is keyed `(channel, slot)`, plus `(channel, placement)` for independent placements. Iteration groups are dropped from infinite schedules. A channel that switches between schedules placing the same slot keeps its position |
| D8 | Deleting a library slot that is still placed requires an explicit mode. `detach` turns each placement into a private copy and carries each channel's position over. `remove` deletes the placements and invalidates the affected buffers | A plain delete of a placed slot is rejected. The UI lists the affected schedules and asks which mode. An unplaced library slot, or a private slot with its placements, deletes without a prompt |
| D9 | Edits reset as little as possible, because resets disrupt viewers. Placement edits keep the position. A filler edit resets only filler state. A season-filter edit keeps the position if the current program still passes, otherwise moves to the next one that does. Only an order, direction or content-source change resets | Saving a slot diffs it by field class to decide what state to touch. Resetting on any edit was rejected |
| D10 | An edit takes effect from the end of the program airing at now + G. G is a per-schedule lock window, default 0 | With G = 0 an edit applies when the current program ends. DVR users raise G to protect booked recordings. A timeline change pushes an invalidation to the ErsatzTV-next worker instead of waiting for its rebuild timer |
| D11 | A buffer refill resumes from the saved cursor. Only an edit (D10) or lost content regenerates existing items | Follows from D10. Settles Q6 |
| D12 | Lost content blocks where Tunarr can ask and breaks visibly where it can't. Deleting a custom show, filler list, smart collection or redirect target that slots use is refused until the caller chooses, as in D8. A media-server purge marks the slot broken. A broken floating placement is skipped, and a broken anchored placement airs flex until the next anchor. A purged program already in a buffer regenerates the timeline from that item at once, ignoring G | Settles Q7. Every Tunarr-owned entity a slot references needs an indexed "used by" lookup. Infinite schedules become a program-lifecycle consumer |
| D13 | Switching lineup mode keeps the inactive side dormant. Nothing reads it, but it stays editable. Classic resumes where it stopped. Infinite keeps its schedule assignment and per-slot positions, discards its buffer, and regenerates from now | Settles Q4. Switching out of classic saves the lineup offset, and switching back rebases `startTime` so that offset airs now (to the minute, per `updateChannel` rounding) |
| D14 | Infinite schedules replace the time-slot and random-slot schedulers on a gated timeline. Classic mode ends as hand-edited lineups only | See [Deprecation plan](#deprecation-plan). Revises D1, which is now the interim state until phase 4 |
| D20 | A schedule stores an IANA zone name, defaulting to the server zone. Anchors are wall-clock times in that zone | Settles Q8. Removes the minute-offset DST guess. Every channel sharing a schedule airs at the same local times |
| D21 | Mid-roll ships at T. Its config lives on the slot beside filler, using the classic `MidRollConfigSchema` rules | Becomes slice 3b, after the core planner (3a) and before T. Slice 2 adds the per-item start offset. Slice 8 drops mid-roll |
| D22 | Anchors use classic's lateness and overflow rules, and the `hard`, `soft` and `padded` modes are dropped. Overflow moves onto the anchor and limits how far earlier content may run into it. Lateness limits how late the anchor may start before it is skipped. The gap before an anchor plays the preceding placement's fallback filler, then flex. A skipped anchor resumes the floating rotation instead of airing flex | Settles Q3. `hard` = no run-over and no lateness. `soft` = unlimited run-over and lateness. `padded` is replaced by the fallback rule. Classic slot *i*'s overflow converts to slot *i+1*'s run-over. The planner models the time between consecutive anchors as windows, which also fixes D3. See the design review's planner findings for how today's trigger-point anchors fail |
| D23 | The anchor settings are named **Spill over** (how far earlier content may run into the anchor) and **Max start delay** (how late the anchor may start before it is skipped). The editor offers "Start on time", "Start after the current program" and "Custom" as shortcuts | Classic keeps "Max overflow" and "Max lateness" until phase 4. Converter docs map the old names to the new ones |
| D24 | `fill` plays until the next anchor, or forever if none follows. One floating `fill` placement with no anchors is valid and plays its slot forever | Settles Q2. A schedule with no anchors, a floating `fill` placement and other floating placements saves, but the editor warns that the others never air |
| D25 | Slice 7 builds its forms on TanStack Form. The March branch `tanstack-form-rewrite-infinite-schedules` is abandoned and renamed `archive/tanstack-form-rewrite-infinite-schedules` | Settles Q10. The branch was 94 commits behind `4ca4b75d`, and D5 replaces its slot form anyway |
| D15 | No feature freeze on classic slot schedulers yet. A PR that adds or changes classic slot behavior adds a row to the [parity checklist](./parity-checklist.md) | Enforced by a `CLAUDE.md` line. If the checklist grows faster than slices close it, revisit a freeze |
| D16 | No bake action. Infinite schedules never write a classic lineup | The generate-then-hand-edit workflow ends with phase 4. Fixed, hand-edited programming means a manual lineup |
| D17 | Phase 3 converts only untouched slot lineups (`schedule` and `scheduleSeed` both present). Lineups without a seed stay classic as manual lineups, and their slot rules become an unassigned infinite schedule. Phase 2 banners list which channels will convert and which will stay | A manual save clears `scheduleSeed` (`LineupRepository.ts:957`). Pre-seed lineups count as hand-edited unless a slot save writes a seed before phase 3 |
| D18 | A preset is a built-in, one-shot generator. It asks a few questions, then creates an ordinary infinite schedule. The editor picks a clock-grid or weights view from the schedule's data, and the user can switch freely | Settles Q15. Presets live in Tunarr's code. User-saved presets wait for shareable templates (slice 8). Phase 2 needs at least time-slot, random-slot and cyclic-shuffle presets |
| D19 | The feature is called "infinite schedules" everywhere: code, tables, API, UI and docs. "Dynamic" is retired | An infinite schedule extends forever, while a classic lineup is a bounded cycle. The `infinite_` table prefix also keeps dynamic tables apart from classic slot code until phase 4 |

## Open decisions

| # | Question | Recommendation | Blocks |
|---|---|---|---|
| Q1 | ~~Rename "infinite" to "dynamic"?~~ | Settled by D19: keep "infinite" | — |
| Q2 | ~~What does `fill` do when no anchor follows? Today a floating `fill` slot rotates after one program~~ | Settled by D3, D24 | — |
| Q3 | ~~How do hard, soft and padded anchors behave?~~ | Settled by D22 | — |
| Q4 | ~~When a channel switches from classic to infinite, does its classic lineup stay dormant or get cleared?~~ | Settled by D13 | — |
| Q5 | ~~When a slot is edited, does it keep its iterator state?~~ | Settled by D9, D10 | — |
| Q6 | ~~Does a buffer refill resume from the saved cursor, or delete everything after now?~~ | Settled by D11 | — |
| Q7 | ~~What happens when content a slot references is deleted or purged?~~ | Settled by D12 | — |
| Q8 | ~~Store an IANA zone instead of a minute offset?~~ | Settled by D20 | — |
| Q9 | ~~Is mid-roll in v1?~~ | Settled by D21: yes | — |
| Q10 | ~~Port or abandon the local branch `tanstack-form-rewrite-infinite-schedules`?~~ | Settled by D25 | — |
| Q11 | ~~Which fields belong to a reusable slot and which to its placement?~~ | Settled by D5 | — |
| Q12 | ~~Does a schedule use a reusable slot by reference or by copy?~~ | Settled by D4 | — |
| Q13 | ~~Is a channel's position kept per slot or per placement?~~ | Settled by D7 | — |
| Q14 | ~~What happens when a placed library slot is deleted?~~ | Settled by D8 | — |
| Q15 | ~~What is a preset?~~ | Settled by D18 | — |
| Q16 | ~~Does "recreate today's styles" include converting existing channels?~~ | Settled by D14, D17: a per-channel converter ships at T | — |
| Q17 | How faithful must infinite schedules be to classic? | Tracked row by row in the [parity checklist](./parity-checklist.md) | Phase 2 |
| Q18 | ~~Does every placement need a named library slot?~~ | Settled by D6 | — |
| Q19 | ~~What is the deprecation strategy for classic slot schedulers?~~ | Settled by D14 | — |
| Q20 | ~~What rule governs new classic slot features?~~ | Settled by D15 | — |
| Q21 | ~~Do infinite schedules get a bake action?~~ | Settled by D16: no | — |
| Q22 | ~~What does phase 3 do with hand-edited slot lineups?~~ | Settled by D17 | — |
| Q23 | ~~What are the anchor settings called?~~ | Settled by D23 | — |

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

## Deprecation plan

T is the stable release that removes the infinite feature flag. Each phase starts when its gate passes and its minimum time has elapsed, whichever is later.

| Phase | Earliest | Ships | Time and random slots | Gate to next phase |
|---|---|---|---|---|
| 0. Build | Now | Slices 1–7 on `dev` behind the flag | Supported. Parity tax instead of a freeze (D15) | Slice 7 merged. Parity checklist written |
| 1. Infinite ships | T | Flag removed. Presets and an opt-in, reversible per-channel converter | Supported | Parity checklist green. Converter reproduces classic output on fixtures |
| 2. Soft deprecation | T + 2 months | Docs and editor banners mark slot schedules deprecated, with a convert button and the channel's phase 3 outcome | Existing schedules editable. No new ones | No open parity bugs for 4 weeks |
| 3. Auto-convert | T + 5 months, announced one release ahead | Untouched slot-scheduled channels convert to infinite. Hand-edited ones stay manual, with an unassigned infinite schedule (D17) | Generated lineup stays dormant (D13). Slot rules kept read-only | One release with no conversion regressions |
| 4. Removal | T + 8 months | Both slot schedulers, their editors, the lineup `schedule` field and the `scheduleSeed` path are deleted | Gone | — |

- Parity is measured by converting classic channels and comparing a week of guide output (`stream-repro --schedule`).

## Plan

- Port from `4ca4b75d`, not `9eeafa1e`.
- Keep infinite mode behind a feature flag until slices 3b and 7b land. Removing the flag is T in the deprecation plan.
- Generate the migration last, just before slice 2 merges.
- Blocker IDs (B1–B10) refer to [01-design-review.md](./01-design-review.md#blockers).
- Work is tracked in [#2104](https://github.com/chrisbenincasa/tunarr/issues/2104), with one sub-issue per slice.

| Slice | Contents | Resolves | Depends on | Status | Tracking |
|---|---|---|---|---|---|
| 0 | Settle Q1–Q23 (done 10/12/2026 except Q17, tracked in the parity checklist). Replace the March spec with this record | — | — | Done | [#2095](https://github.com/chrisbenincasa/tunarr/issues/2095) |
| 1 | Shared building blocks, written infinite-first and borrowed by classic until phase 4 (D14), with no classic behavior change: serializable content iterators, season filter, filler selection | Parity bugs (shuffle wrap, season 0, cooldown) | 0 | Not started | [#2096](https://github.com/chrisbenincasa/tunarr/issues/2096) |
| 2 | Schema and DB: lineup mode column and dormant-side offset (D13), slot and placement tables with library and private slots (D5, D6), per-slot and independent-placement state (D7), IANA zone (D20), lock window G (D10), `end_time_ms`, start offset (D21), indexed FKs with "used by" lookups and no cascades (D8, D12), unique `(channel, sequence)`, transactional writes, field-class slot diffing (D9) | B5, B9 | 0 | Not started | [#2097](https://github.com/chrisbenincasa/tunarr/issues/2097) |
| 3a | Infinite planner ported onto slice 1: anchors as windows with spill over and max start delay (D3, D22, D23), `fill` until the next anchor or forever (D24), rerun and independent placements (D7), correct resume, one shared path for ordered and shuffle modes, test suite restored | B3, B7 | 1, 2 | Not started | [#2098](https://github.com/chrisbenincasa/tunarr/issues/2098) |
| 3b | Mid-roll on slots, using classic break rules (D21) | — | 3a | Not started | — |
| 4 | Generation service: background buffer task resuming from the cursor (D11), per-channel lock, one transaction per run, edit invalidation from the end of the program airing at now + G (D10), push to the ErsatzTV-next worker, program lifecycle consumer with immediate regeneration on purge (D12) | B2 | 3a | Not started | [#2100](https://github.com/chrisbenincasa/tunarr/issues/2100) |
| 5 | Runtime readers: lineup-mode dispatch, including `EtvNextPlayoutWriter`, one timeline with point and range reads, play history stamped at playback, stream safeguards, remaining lineup consumers | B1 | 4 | Not started | [#2102](https://github.com/chrisbenincasa/tunarr/issues/2102) |
| 6 | API: one `/schedules` route family plus slot library, assignment and lineup-mode switch, delete modes for placed slots and referenced entities (D8, D12), controller pattern, server-minted IDs, validation on every write | — | 2 | Not started | [#2099](https://github.com/chrisbenincasa/tunarr/issues/2099) |
| 7 | Web: schedule pages with clock-grid and weights views (D18), slot library with promote and detach (D6), lineup-mode switch and assignment, infinite filler panel with playback modes, TanStack Form driven by zod (D25), anchor shortcuts (D23), unreachable-placement warning (D24), preview of unsaved edits | B6, B8, B10 | 6 | Not started | [#2101](https://github.com/chrisbenincasa/tunarr/issues/2101) |
| 7b | Built-in presets (time slots, random slots, cyclic shuffle) and the per-channel classic converter, both required at T (D14, D17, D18) | — | 3b, 7 | Not started | — |
| 8 | Filler profiles, shareable templates (mid-roll moved to 3b, D21) | — | 5, 7 | Not started | [#2103](https://github.com/chrisbenincasa/tunarr/issues/2103) |

### Rules for every slice

- Classic behavior changes only in slice 1 and the separate fixes below.
- Infinite types get their own names. The shared `SlotFiller` stays untouched, which avoids B4.
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
| `shareable-schedules.md` | Not started. Per D1, it should target infinite schedules only |

## How to resume

- Settle the open decisions with the author before slices 1–3 start.
- Read [01-design-review.md](./01-design-review.md) for the evidence behind each blocker and finding. Line numbers refer to commit `9eeafa1e` unless marked otherwise.
- Update the Status and Tracking columns as slices open PRs.
