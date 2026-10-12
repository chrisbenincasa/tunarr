# Issue #1362: program after a redirect slot starts early

> **Status (10/08/2026):** Not reproduced on v0.22.2 or `main`. Asked the reporter for settings and labeled `pending response`. The stale workflow closes it after 37 days with no reply.

## Report

- Version 0.22.2, time slots.
- A program slot that follows a channel-redirect slot starts "at the exact hour" in the generated schedule. A movie set for 8:30 starts at 8:00.
- The reporter worked around it by putting a short show before the movie.

## What was tested

- Ran `scheduleTimeSlots` from v0.22.2 (in a throwaway worktree) and from `main` with the same scenario.
- Slots were a show at 00:00, a redirect at 07:00 or 08:00, a movie at 08:30, and a show at 12:00.
- Pads were 1 ms, 30 min, and 60 min. Flex preference was `end` and `distribute`.

| Pad | Result in both versions |
|-----|-------------------------|
| 1 ms | Redirect ends at 08:30. Movie starts at 08:30. |
| 30 min | Redirect ends at 08:30. Movie starts at 08:30. |
| 60 min | Redirect ends at 08:30. The movie slot is all flex, because the 1 h pad pushes the cursor to 09:00 and lateness 0 rejects the slot. |

- Both versions give a redirect the full remaining slot length, and the lineup save path keeps that duration.

## Open questions for the reporter

- Pad, lateness, flex preference, and period (daily or weekly).
- Exact slot times, including the redirect slot.
- Whether it still happens on a current release.

## Side finding

- A 60 min pad with a slot that starts on the half hour turns the whole slot into flex. That is how padding and lateness interact. It is not this bug, but the editor gives no warning.
