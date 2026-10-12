# Infinite schedules parity checklist

Everything the time-slot and random-slot schedulers do that infinite schedules must also do before deprecation phase 2 (see [README](./README.md#deprecation-plan)).

- **Status values:** `unverified`, `gap`, `supported`, `won't port`
- A PR that adds or changes classic slot behavior adds a row here (D15).
- `won't port` needs a reason and an owner sign-off.

| Behavior | Classic source | Infinite status | Notes |
|---|---|---|---|
| Per-slot lateness | `TimeSlotSchedulerService.ts` (#2255) | unverified | Same rules as classic (D22) |
| Max overflow (none, duration, one extra) | `TimeSlotService.ts:319` | unverified | Moves onto the following anchor as run-over (D22) |
| Leftover slot time plays the slot's fallback filler | `TimeSlotService.ts:452` | unverified | Gap before an anchor (D22) |
| Late slot skipped as flex for its whole window | `TimeSlotService.ts:274` | won't port | Infinite resumes floating content instead (D22) |
| Mid-roll breaks, kept inside the time slot | `midRollBreakRules.ts` (#2283) | gap | Slice 3b, ships at T (D21) |
| Flex distribution (`distribute` / `end`) | `SlotImpl.ts` | unverified | |
| Linked slots, `continue` and `rerun` | `slotSchedulerUtil.ts` | unverified | Replaced by slot identity plus `rerun` / `independent` (D7). Includes `rerunOverflow` (`flex` / `continue`) |
| Filler cooldown shared between linked slots | #2166 | unverified | |
| Random-slot weights and cooldown | `RandomSlotSchedulerService.ts` | unverified | Shuffle order |
| Weekly and daily periods, DST handling | `TimeSlotService.ts` (#1445) | unverified | D20 stores an IANA zone, so infinite schedules should exceed classic here. Classic has open DST bugs (#1445) |
| Seeded, repeatable regeneration (`scheduleSeed`) | `RegenerateChannelLineupCommand.ts` | unverified | |
| Generate then hand-edit a fixed lineup | Slot editors | won't port | D16. Fixed programming becomes a manual lineup |
