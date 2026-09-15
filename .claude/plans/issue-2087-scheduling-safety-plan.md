# Scheduling input safety (GitHub #2087)

Implementation is proposed; no production fixes have been applied. The investigation compared v1.3.14 (`9c063763`) with main (`288d633a`).

- The issue is [#2087](https://github.com/chrisbenincasa/tunarr/issues/2087).
- The [reply draft](issue-2087-reply-draft.md) is separate and has not been posted.
- Implementation should use a new fix branch from main and preserve existing worktrees.

## Goal

Reject invalid scheduling requests before changing state. Keep empty custom shows out of new slot choices. Make scheduling terminate safely when previously valid content becomes unavailable.

## Evidence and limits

| Finding | Evidence | Consequence |
| --- | --- | --- |
| Empty dynamic random slots loop without advancing time. | Real scheduler calls timed out after three seconds; a queued 100 ms timer never fired. Positive fixed-slot and populated dynamic-slot controls completed. | Default inline scheduling can freeze HTTP during a programming write. |
| Nonpositive durations reach scheduling. | A fixed duration of zero passes the request schema and stalls generation. A zero-duration program also stalls generation; fixed-slot packing exhausted a bounded test heap. | Request validation and inner-loop progress checks both need correction. |
| Empty custom-show updates retain old membership. | Three real SQLite tests covered explicit empty replacement, all-unresolved replacement, and valid replacement. | An explicit replacement is confused with an omitted update. |
| Zero random slots have inconsistent behavior. | Sequential selection throws; uniform selection returns 24 days of flex. | New requests need a defined contract; older saved rules need safe runtime handling. |
| Manual content duration zero passes request validation but fails lineup validation. | Both schemas were exercised. SQL updates precede the lineup write. | Validate the derived lineup before mutation; SQL/cache corruption from this path is not yet reproduced. |

Empty manual lineups and missing program IDs completed guide generation and became flex in service tests. Startup waits for guide construction but does not rerun persisted random rules. The reported successful-write → restart → guide-hang sequence remains unverified.

The cited library-refresh path skips local sources. Valid SQLite membership does not establish that the separate channel lineup JSON has valid references.

## Behavior contract

| Situation | Chosen behavior |
| --- | --- |
| A custom show has no content. | Keep it creatable and editable, but exclude it from selectable options for new slots. |
| A saved slot references an empty or deleted show. | Keep its identity visible with an unavailable warning; never substitute another show. |
| A new scheduling request explicitly references an empty or unresolved custom show. | Return HTTP 400 with the slot and show identified; leave stored state unchanged. |
| A new request has zero random slots, a nonpositive fixed duration, or an invalid dynamic count. | Return HTTP 400 before calling the scheduler. |
| A new programming write contains an unresolved content ID or nonpositive content duration. | Return HTTP 400 before mutating SQL, lineup files or caches. |
| An existing fixed slot loses its content. | Preserve the existing positive-duration flex fallback. |
| An existing dynamic slot yields nothing. | Try other eligible slots through a bounded search; do not repeatedly select the empty slot at the same cursor. |
| No slot can produce content. | Advance to the next valid cooldown boundary or fill the remaining generation window with flex and finish. |
| Previously stored rules contain zero slots. | Return flex for the requested window consistently across distributions. |
| A caller explicitly clears a custom show. | `programs: []` replaces membership with an empty set. An omitted field leaves membership alone. |
| A custom-show replacement contains unresolved IDs. | Reject the whole replacement with HTTP 400; do not silently drop IDs or retain old membership while reporting success. |
| A channel has an empty manual lineup. | Keep it valid and retain the normal flex guide. |

Request validation uses current resolved content, not UI counts. Runtime checks remain necessary for older saved rules, direct service callers, content changes and exhausted iterators.

## 1. Stop scheduler nonprogress

Work in `server/src/services/scheduling/RandomSlotsService.ts`, its existing tests, and the existing iterator helpers where the same behavior is shared.

- Fix the empty result from `handleDynamicDurationSlot`; its caller currently continues without changing the cursor.
- Bound attempts at each cursor by the candidate slots. Exclude a dynamic slot that yielded nothing for that cursor, then reset exclusions after time advances.
- Preserve sequential order, random weights, cooldowns and linked-iterator behavior. Do not mark an empty slot as played merely to manufacture progress.
- When remaining candidates are cooling down, advance to the earliest valid future boundary, capped at the generation end. When none can produce content, fill only the remaining window with flex.
- Handle zero slots before selecting a sequential slot. Apply the same bounded result to every distribution.
- Reject invalid slot durations in the scheduler's own validation, even when request parsing was bypassed.
- Exclude nonpositive or non-finite resolved program durations before packing. Bound iterator exhaustion handling; do not add a second infinite loop while skipping bad content.
- Guard fixed-slot packing before appending an item that contributes no positive duration. Stop with a contextual error if an unexpected invalid padded result survives validation.
- Require each outer-loop pass to advance time, consume a remaining candidate in the bounded search, or terminate. A timer cannot interrupt the current synchronous loop.
- Report unavailable or invalid content once per build with slot/program identifiers. Do not emit per-iteration warnings.
- Exercise time-slot scheduling through its shared helpers as a regression control; extend the correction there only if the same failure is reproduced.

## 2. Validate requests and derived lineups before mutation

Reuse the split between permissive stored schemas and `StrictTimeSlotScheduleSchema` in `types/src/api/TimeSlots.ts`.

- Add request-only strict random validation based on `types/src/api/RandomSlots.ts`. Require at least one slot, finite positive fixed durations, and positive integer dynamic counts; cover any supported legacy duration representation deliberately.
- Wire strict validation into both random preview generation and the random branch of programming writes. Keep stored `LineupSchedule` parsing permissive enough to load older data for repair.
- Apply positive-duration checks to the manual request shape without globally tightening shared program metadata schemas used outside writes.
- Validate resolved references at the scheduling service/repository boundary so preview, save and non-HTTP callers cannot diverge. Reuse the resolved program snapshot used for generation rather than fetching each show separately.
- Reuse the API's existing HTTP 400 error handling. Include the slot index and relevant identifier in messages; avoid exposing media paths or credentials.
- Build and validate the final `LineupSchema` value before `LineupRepository.updateLineup` updates channel SQL or mutates the Low database's in-memory value.
- Retain saved-lineup validation. Request and persisted shapes are not equivalent; the zero-duration discrepancy proves it is not redundant.
- Preserve the last good lineup and guide on rejected requests. Test SQL, JSON and cached values rather than relying on the response code alone.

Primary files include `server/src/api/channelsApi.ts`, `server/src/db/channel/LineupRepository.ts`, `server/src/db/derived_types/Lineup.ts`, and `types/src/api/index.ts`.

This step replaces the saved-lineup validation removal proposed in [the older slot-save plan](slot-save-skew-plan.md). It does not introduce a cross-file/database transaction framework or overlap the separate library-reconciliation worktree.

## 3. Correct custom-show replacement semantics

Work in `server/src/db/CustomShowDB.ts` and `server/src/api/customShowsApi.ts`.

- Distinguish an omitted `programs` field from an explicitly empty array in `saveShow`.
- Resolve every supplied ID before updating show metadata or membership. Reject unresolved replacements atomically, including mixed valid/invalid lists.
- In the existing transaction, delete prior membership for an explicit replacement even when the replacement is empty; insert only when there are replacement rows.
- Keep creation of an empty custom show valid for staged API authoring.
- Reuse custom-show query invalidation so editors receive updated counts after a save.
- Do not regenerate existing channel lineups or invalidate guides as a substitute for updating membership. Channel lineups contain materialized programming; changing that contract is outside this fix.

## 4. Remove empty shows from new choices without hiding broken selections

`web/src/hooks/programming_controls/useSlotProgramOptions.ts` already supplies `programCount` from `CustomShow.contentCount`; no extra request is needed.

- Preserve the full option catalog in the provider. Derive selectable new-slot options separately so filtering does not erase the identity of an existing selection.
- Exclude known-empty custom shows from new-slot pickers and defaults in both time and random editors. Treat loading/error states separately from a confirmed zero count.
- When no selectable custom show exists, prevent creating that slot type and explain that it needs content. Continue allowing available programming types and explicit flex slots.
- Preserve an existing empty or missing show as a labeled unavailable selection. Remove the custom-show Autocomplete's `find(...) ?? first(...)` fallback, which can display a different show while retaining the old ID.
- Guard default selection in `AddTimeSlotButton`, `AddRandomSlotButton`, `EditTimeSlotDialogContent` and `EditRandomSlotDialogContent`; filtering must not create an unchecked empty-array access.
- Extend the existing `SlotWarning` and warnings dialogs for empty custom shows. Reuse materialized `isMissing` metadata for deleted shows and expose it in the random table as well as the time table.
- Keep invalid saved rows editable/removable, but block their submission until repaired. Do not silently delete them from the LineupSchedule.
- Surface the server's validation message in `useScheduleSlots.ts` and programming-save feedback instead of replacing HTTP 400 details with a generic snackbar.
- Use existing localization and warning components. Test a small shared selection predicate rather than introducing another option store.

Relevant components are under `web/src/components/slot_scheduler/`; details and warning models live in `web/src/hooks/slot_scheduler/useScheduledSlotProgramDetails.ts` and `web/src/model/CommonSlotModels.ts`.

## 5. Verify worker timeout cleanup separately

`TUNARR_USE_WORKER_POOL` defaults to false. With it enabled, the current queue timeout rejects the promise but does not itself terminate a spinning worker.

- Reproduce timeout behavior with a disposable worker and a bounded external watchdog before changing the pool.
- If the timed-out worker remains occupied, extend the existing pool to terminate and replace that worker, release its capacity, and reject the task exactly once. Verify that a later task completes.
- Preserve queue ordering and shutdown behavior in tests.
- Keep this as a separate change after the scheduler fixes. Do not enable workers globally or present the existing timeout as a cure for nonprogress.
- Coordinate any broader worker-default change with the existing slot-save plan instead of creating a competing rollout.

## Regression and acceptance checks

Write failing regressions before fixes. Run known hangs in child processes with an external deadline until the scheduler can terminate them safely; an in-process test timeout cannot stop a blocked event loop.

| Test | Required result |
| --- | --- |
| Empty dynamic custom show under sequential, uniform and weighted selection | Generation finishes; no repeated selection at an unchanged cursor. |
| Empty dynamic slot mixed with healthy slots, cooldowns and linked slots | Healthy content still schedules; existing ordering and cooldown rules hold. |
| Positive fixed slot with empty content | Flex covers the slot and advances time. |
| All slots unavailable, or older saved rules with zero slots | Flex covers the requested window without the current 24-day overshoot. |
| Fixed duration zero/negative; invalid dynamic count | New requests return 400; direct scheduler calls terminate with a useful error. |
| Zero-duration program, alone and mixed with valid content | Fixed and dynamic packing terminate without unbounded allocation. |
| Empty manual lineup and persisted missing content ID | Guide construction and materialization retain their flex fallbacks. |
| New unresolved references or invalid derived lineup | Request fails before SQL, file, cache or guide changes. |
| Custom-show field omitted, empty, valid, unresolved and mixed | Omitted preserves; empty clears; valid replaces; unresolved rejects atomically. |
| Empty show in time/random editors; saved show later empty/deleted | New choice is unavailable; saved identity remains visible and repairable. |
| Rejected request through the real endpoint with default inline scheduling | Response returns promptly; a second `/api/version` request remains responsive. |
| Timeout with workers enabled | Capacity is recovered and a subsequent valid task completes. |

- Extend `RandomSlotsService.test.ts`, `TimeSlotService.test.ts`, the schema validation tests and real SQLite custom-show tests. Add endpoint tests that reach generation and persistence, not only schema injection.
- Use the existing strict/permissive cases in `server/src/types/timeSlotScheduleValidation.test.ts` as the schema test pattern.
- Extend pure web helper tests and drive the time/random editors in a browser, including a failed API save and an unavailable saved selection. Unit tests alone do not establish the visual behavior.
- Add isolated startup fixtures for empty/missing-program lineups to preserve the known-good guide behavior. Do not claim these reproduce the reporter's restart failure.
- Run focused tests during each change, then `pnpm turbo test`, `pnpm turbo typecheck` and `pnpm lint-changed` before completion.
- Regenerate OpenAPI and the web client when the request/response contract changes. Update the relevant scheduling and API documentation with the chosen empty-input behavior.

## Minimal reproduction input

The isolated scheduler reproduction resolves the custom show below to no content. The body is schema-valid in the examined release; generation hangs before it could be persisted.

```json
{
  "type": "random",
  "programs": [],
  "schedule": {
    "type": "random",
    "flexPreference": "end",
    "maxDays": 0,
    "padMs": 1,
    "padStyle": "slot",
    "randomDistribution": "none",
    "slots": [
      {
        "id": "33333333-3333-4333-8333-333333333333",
        "type": "custom-show",
        "customShowId": "11111111-1111-4111-8111-111111111111",
        "order": "next",
        "direction": "asc",
        "weight": 1,
        "cooldownMs": 0,
        "durationSpec": { "type": "dynamic", "programCount": 1 }
      }
    ]
  }
}
```

The control changes only `durationSpec` to `{ "type": "fixed", "durationMs": 3600000 }`; it returns one day of flex. The HTTP integration regression must create the referenced empty show and channel rather than merely echo a validated body.

## Unresolved restart report

Request the successful programming payload, affected channel lineup JSON, and startup logs with the external publisher stopped. A process sample during the hang can distinguish startup work from a new API-triggered scheduler call.

Do not change HTTP binding order, guide retries, source identity or library deletion based on the two warning messages alone. The verified fixes above can proceed independently of that evidence.
