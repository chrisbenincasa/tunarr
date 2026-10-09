# Issue #1369: weekly time slots ignore the channel start day

> **Status (10/08/2026):** Fixed in v1.1.15. Not reproducible on `main`. Next step is to close the issue with the note below.

## Report

- Version 0.22.2 (build `106da94`), Jellyfin, Docker.
- Channel start set to Tuesday 09/09/2025. A weekly time-slot schedule then played Sunday's slots on Tuesday.
- Side symptoms:
  - Preview or save reset the start date to today, or to the most recent Sunday for weekly schedules.
  - A start date changed in channel config showed on the programming page only after a browser refresh.

## Root cause (0.22.2)

- `scheduleTimeSlots` ignored the channel start time. It anchored the lineup at `now.startOf(period)` plus the first slot's offset, which is today for daily schedules and the current week's Sunday for weekly ones.
- `ChannelDB` then wrote that anchor back into `channel.startTime`, so the user's date was overwritten.
- A lineup is a list of durations played from `channel.startTime`. When the user moved the start back to Tuesday in channel config, nothing regenerated the lineup, so its first item (Sunday's slot) aired on Tuesday.

## Fixes

| Commit | Change | First tag |
|--------|--------|-----------|
| `84b88c0d9` | Scheduler starts at `channel.startTime` and reads slot offsets from that time's period. `ChannelDB` stops overwriting the start time. | v1.1.15 |
| `1966218bb` | Changing the channel start time regenerates slotted lineups (`RegenerateChannelLineupCommand`). | v1.1.15 |

## Verification on `main`

- Ran a scratch test: weekly schedule with Sunday and Saturday flex and show slots Monday through Friday, started at `2025-09-09T00:00` (Tuesday).
- Ran it under `America/New_York`, `America/Bogota`, and `UTC`.
- Lineup starts at Tuesday 00:00 with content. The first full-day flex block falls on Saturday.
- A Tuesday 13:37 start airs flex until Wednesday 00:00. That follows from `latenessMs: 0` and is not this bug.
- The stale programming page after a channel config save is a web-cache symptom. It was not tested in a browser.
