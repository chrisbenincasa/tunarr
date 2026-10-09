# Issue #1445: DST breaks slot time entry and slot schedules

> **Status (10/09/2026):** Investigated, not started. The web picker bug and two server generator bugs are confirmed; the looping drift is inferred from code. Next step is to pick the PR split and start Phase 1 before the US fall-back on 11/01/2026.

## Report

- Version 0.22.11, Docker, Firefox and Chromium. Filed 11/02/2025, the day US DST ended.
- Typing "10" in a time slot's start time showed "09". Changing AM/PM changed the other fields.
- It went away the next day, except when Sunday was part of the schedule.
- Maintainer reopened it to fix time entry. Scheduling across a midday DST change was noted as a separate, harder problem.

## Findings

| # | Problem | Where | Evidence |
|---|---------|-------|----------|
| 1 | Time picker shows and saves the wrong hour during a DST day or week | `web/`, about 7 components | Code reading, matches the report |
| 2 | Generator shifts the whole lineup 1 h when the start falls after a transition in the same period | `TimeSlotService.ts:173-216` | Scratch test, below |
| 3 | Generator is 2 h off in the southern hemisphere | Same | Scratch test, below |
| 4 | Generated lineups loop on fixed real time, so they likely drift 1 h at each transition | `StreamProgramCalculator.ts:635` | Code reading only |
| 5 | Server ignores the schedule's `timeZoneOffset` and uses the process timezone | `types/src/api/TimeSlots.ts:175` | Code reading |

### 1. Web time picker

- A slot stores `startTime` as ms after the start of its period. The stored value is correct.
- The picker converts it back with `dayjs().startOf(period).add(ms)`. Adding ms is elapsed time, not clock time.
- On a 25 h day, midnight + 10 h reads 09:00. `onChange` reads `.hour()` from that value and saves it, so the field jumps.
- Weekly schedules use `startOf('week')`, so the whole week containing the transition is affected. This matches the "only when Sunday is included" comment.
- Same pattern:
  - `web/src/components/slot_scheduler/EditTimeSlotDialogContent.tsx:378`
  - `web/src/components/slot_scheduler/EditRandomSlotDialogContent.tsx:486`, `:515`
  - `web/src/components/programming_controls/AddRestrictHoursModal.tsx:40-43`
  - `web/src/hooks/programming_controls/useRestrictHours.ts:29`
  - `web/src/components/programming_controls/AddBreaksModal.tsx:86`, `:126`, `:173` (these fields hold durations; check whether they're affected)
  - `web/src/components/settings/general/BackupForm.tsx:171`
  - `web/src/components/settings/general/LogRollForm.tsx:158`

### 2 and 3. Server generator DST compensation

- `scheduleTimeSlots` computes the slot position as `timeCursor.diff(startOfCurrentPeriod)` plus a correction.
- The correction compares each offset to January 1's offset and adds or subtracts a fixed `OneHourMillis`.
- The reference is wrong. The correction should compare against `startOfCurrentPeriod`'s offset, but it compares against the generation start. A start after a transition earlier in the same day or week therefore shifts every slot by 1 h for the whole lineup.
- The sign is wrong in the southern hemisphere. January is summer time there, so the code applies -1 h where +1 h is needed, and the error is 2 h.
- The fixed 1 h is wrong for zones with a 30 min shift (Lord Howe Island).
- Generation starts at `channel.startTime` (`RegenerateChannelLineupCommand.ts:47`). Bug 2 triggers when that time falls after a transition in its own period.

Scratch test (deleted): a movie slot at 00:00 and a show slot at 18:00, 1 h programs, `padMs` 1 h. The table shows when the show first airs each day, in wall-clock time.

| TZ | Case | Show airs at |
|----|------|--------------|
| America/New_York | Daily, start 10/31/2025 00:00, spans fall-back | 18:00 (correct) |
| America/New_York | Daily, start 11/02/2025 12:00, after that morning's fall-back | 17:00 every day |
| America/New_York | Weekly, show Wed 18:00, start Wed 11/05/2025 | 17:00 every week |
| Australia/Sydney | Daily, spans spring-forward 10/05/2025 | 20:00 on the transition day, then the slot runs past midnight |
| Australia/Sydney | Daily, spans fall-back 04/06/2025 | 16:00 every day after |

- Existing tests (`TimeSlotService.test.ts:1990`) start at midnight in New York only, so they pass.
- The existing spring-forward test expects the 18:00 slot to be skipped on 03/09/2025 and first air on 03/10. That is a symptom of the heuristic and should change.

### 4. Looping lineups

- A slot lineup covers `maxDays` and then repeats, using `timeSinceStart % channelDuration`.
- Only the API regenerates a lineup (`channelsApi.ts:334`). No task does it on a schedule.
- A loop with a fixed real-time length can't stay aligned to wall-clock time across a transition. A lineup built in October should air every slot 1 h early after the fall-back until someone regenerates it.
- Not reproduced. This is probably the symptom users notice most.

### 5. Timezone source

- The web app sends `timeZoneOffset: new Date().getTimezoneOffset()`. No server code reads it.
- The server interprets slot times in its process timezone. A Docker container left on UTC has no DST handling, and its slots don't match the user's wall-clock time.

## Plan

### Phase 1: web picker (target `main`, before 11/01/2026)

- Build picker values from clock fields: `dayjs().startOf('day').hour(h).minute(m)`, plus `.day(d)` for weekly.
- Add one shared helper in `web/src/helpers/slotSchedulerUtil.ts` (ms offset ↔ `Dayjs`) and use it at every site listed above.
- Test: unit-test the helper under `TZ=America/New_York` on 11/02/2025 and 03/09/2025, round-tripping every hour.

### Phase 2: generator clock-time offsets (target `main`)

- Replace the `startOfYear` heuristic with
  `currOffset = timeCursor.diff(startOfCurrentPeriod) + (timeCursor.utcOffset() - startOfCurrentPeriod.utcOffset()) * 60_000`.
- Use the same value for `currentPeriodIndex`.
- Spring-forward gap: a slot whose start doesn't exist that night (for example 02:30) starts at the first valid time (03:00). Lateness rules do not flex it out.
- Fall-back repeat: the clock offset moves backward by 1 h. Don't re-enter earlier slots. Extend the current slot, or fill with flex. **Decision needed.**
- Check `RandomSlotsService.ts` for the same pattern.
- Tests: parameterize the DST suite over `America/New_York`, `Australia/Sydney`, `Australia/Lord_Howe`, and `UTC`, with starts at midnight, before the transition, and after the transition on the same day and in the same week. Assert that every slot airs at its configured clock time.

### Phase 3: stop looping drift (target `main`)

- Option A: a scheduled task that regenerates slot-based channels shortly after each local DST transition, plus on demand.
- Option B: warn in the slot editor when the lineup or its loop crosses a transition.
- Long term: generate forward instead of looping. Check whether the infinite-schedules work on `dev` already does this.
- First, reproduce the drift with `stream-repro` or a lineup calculator test, so the fix has a baseline.

### Phase 4: explicit timezone (later, needs a lineup migration)

- Store an IANA zone name on the schedule or channel, defaulting to the server zone.
- Generate with `dayjs.tz(..., zone)`. Note that `dayjs.tz` objects keep a stale `utcOffset()` after `.add()` (see the test comment at `TimeSlotService.test.ts:1996`), so this needs care or a different date library.
- Drop or deprecate `timeZoneOffset`.

## Open decisions

- Whether Phases 1 and 2 ship as one PR or two.
- What fall-back does during the repeated hour (extend or flex).
- Whether Phase 3 uses an auto-regenerate task or only a warning.
