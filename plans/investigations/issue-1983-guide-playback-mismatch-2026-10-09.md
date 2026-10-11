# Issue #1983: guide and playback disagree on time-slot smart-collection channels

> **Status (10/09/2026):** Investigated. Likely root cause already fixed by #2241 (in v2026.10.0). Not reproduced against the reporter's channel. Next step: ask the reporter to retest on v2026.10.0.

## Verdict

- Real bug, most likely the short-item skip fixed in #2241 (issue #2240)
- Reporter ran v1.3.10, which predates both relevant fixes
- Not a shuffle or ordering bug. The lineup is generated once, and guide and playback read the same file.

## Root cause (likely)

- `calculateStreamDuration` (`server/src/stream/StreamProgramCalculator.ts`) skipped any item with under `SLACK` (9999 ms) remaining
- Items shorter than 10 s were skipped outright, and the next item started at offset 0
- The session clock then ran ahead of the guide by the skipped amount. The drift never self-corrected and the session carried it to later viewers.
- Time slots with "Do not pad" (`padMs: 1`, the UI default) emit many sub-10 s flex gaps between episodes
- In a shuffled multi-show lineup, any boundary offset shows a different show, so a drift of a few minutes reads as "an entirely different program"

## Evidence

| Check | Result |
|-------|--------|
| Scheduler probe, 160 episodes, smart-collection slot, 7 days | No bad, fractional, or non-monotonic durations. Guide and playback index lookups agree at every minute. |
| Sub-10 s flex items, `padMs: 1` | 310 (shuffle) and 125 (ordered_shuffle) per 8.7-day cycle, totaling 27 and 7.6 minutes |
| Sub-10 s flex items, `padMs` 60 s or 30 min | 0 |
| Reporter log | XMLTV rebuilt after each save (17:36, 17:39, 17:40 UTC on 08/10/2026), so the guide was not stale |

- The reporter says cyclic shuffle fixed it. Random slots don't align to clock times, so they don't need the short alignment flex.
- This fit is inferred. The random-slot output was not probed.

## Secondary contributor (fixed)

- #2002 (`3f681d98d`, in v1.3.15). `loadLineup` handed out the cached lowdb object by reference.
- A lineup save landing during a guide build paired old offsets with new items, which produced plausible but wrong airtimes
- It only affects a guide built across a save, so a later rebuild clears it

## Separate bug in the same log

- 50 failed saves, `NOT NULL constraint failed: channel.duration`, 08/09–08/10/2026
- `updateLineup` sums `durationMs` with `sumBy`. One undefined item duration makes the sum NaN, and SQLite stores NaN as NULL.
- The transaction rolls back before `saveLineup`, so the guide and lineup stay consistent. This bug does not explain #1983.
- The item lacking a duration was not traced
