# Streams freeze at 00:00 and 00:40 after upgrading to 2026.11.2

> **Status (11/14/2026):** Root-caused from the reporter's debug log. Two separate event loop stalls, both introduced in v2026.11.2. Fixes on branch `fix/scan-event-loop-stalls`. Reported outside GitHub, so no issue number.

## Report

- Windows 11 x64, Tunarr 2026.11.2, FFmpeg n7.1.1, ErsatzTV next 0.2.5. Upgraded from 2026.10.3.
- Media source rescan interval is 24 hours.
- Streams freeze for a few seconds at 00:00 and 00:40 every night. Audio cuts out while video fast-forwards to catch up.
- Jellyfin scans log "UNIQUE constraint failed" errors.
- Asks whether the scan time can be changed.

## Evidence

- Two logs. The second is a debug log covering 11/13/2026 00:00 to 00:51.
- Both freezes are about 13 s and line up with the reported times.

| Time (local)            | Log                                                   | Running                             |
| ----------------------- | ----------------------------------------------------- | ----------------------------------- |
| 00:00:03.3 → 00:00:16.1 | 2,756 "No text-based subtitles" lines, every ID twice | Two `SubtitleExtractorTask` runs    |
| 00:40:18.2 → 00:40:31.7 | No lines at all                                       | End of the Anime Shows library scan |

- The collection scan and the HLS segment cleanup timer both stop during the 00:00 window and resume within 300 ms of its end.
- Log timestamps are taken when a message is created, so a steady stream of lines does not mean the event loop was free.

## Cause 1: grouping state sync query (00:40)

- `syncGroupingStates` runs at the end of every TV show scan. Added in #2450, first released in v2026.11.2.
- It calls `ProgramStateRepository.syncGroupingStatesForLibrary`, which runs two UPDATEs over every season and show in the library.
- Both use a correlated `EXISTS` that matches `p.state = 'ok'` and ORs four parent columns.
- SQLite chooses `program_state_index` for the subquery. For each grouping it walks every 'ok' program in the database, so cost grows with groupings × programs.
- `better-sqlite3` is synchronous, so the whole server waits for the query.
- The Anime Shows library has about 25,000 episodes.

Measured on a dev database (783 seasons and shows, 8,930 programs):

| Predicate         | Plan                        | Time      |
| ----------------- | --------------------------- | --------- |
| `p.state = 'ok'`  | `program_state_index`       | 2.6–3.4 s |
| `+p.state = 'ok'` | MULTI-INDEX OR on 4 parents | < 10 ms   |

- The same method runs after local TV, local music, and remote music artist scans.

## Cause 2: subtitle extraction filler pass (00:00)

- #1876 added `handleFillerLists` to `SubtitleExtractorTask`, first released in v2026.11.2. It checks every program in a filler list that may select subtitles, every hour.
- The reporter's filler is local bumpers. For a program with no subtitle rows, the task re-reads stream details. For local media that read only touches SQLite.
- With no real I/O per program, every `await` resolves as a microtask. Node never reaches timers or sockets until the whole list is done. 1,378 programs took about 6.5 s per run.
- `UpdateXmlTvTask` calls `SubtitleExtractorTask.runNow` after each guide update. Scheduled guide updates fire on the same tick as the hourly extraction run, and `runNow` does not check for a run in progress, so two runs overlap and the stall doubles.
- Expected pattern is a shorter stall every hour and a doubled one at each guide refresh (every 4 h for this reporter). Not confirmed, because the log covers only 00:00 to 00:51.
- The collection scan at 00:00 is a bystander. It was stalled by this, not the cause.

## UNIQUE constraint errors

- Unrelated to the freezes. Already fixed on `main` by #2518.
- In v2026.11.2 the collection scanner loads existing collections per library, but the unique key is per media source. A Jellyfin BoxSet appears in every library, so each library after the first fails its collection scan.

## Side finding: collection tags re-added on every scan

- `ExternalCollectionScanner.enumerateCollection` diffs against `external_collection_programs`. Nothing writes that table.
- Every scan treats every collection item as new, re-tags it, and resends it to Meilisearch. The log shows "Adding … program tag associations" on every collection and never "Removing".
- Predates the upgrade. Not fixed by this branch.

## Scan time

- Not configurable. `hoursCrontab` builds `0 {minute} */{hours} * * *`, so a 24 h interval runs collections at 00:00 and library scans at 00:30.
- #2070 tracks a configurable cron expression.
- Moving the scan would not fix the 00:00 freeze, which comes from subtitle extraction.

## Fixes (`fix/scan-event-loop-stalls`)

| Fix                                                                  | File                                   |
| -------------------------------------------------------------------- | -------------------------------------- |
| `+p.state` keeps SQLite on the parent indexes; test asserts the plan | `db/program/ProgramStateRepository.ts` |
| Yield to the event loop before each program                          | `tasks/SubtitleExtractorTask.ts`       |
| Guide update skips the extraction run while one is in progress       | `tasks/UpdateXmlTvTask.ts`             |

- A slow query log (separate branch) would have named cause 1 directly in the reporter's log.
- Cause 2 is many fast queries, so a slow query log would not catch it. An event loop delay monitor would.

## Workarounds until a release ships

- If no channel needs subtitles, use stream selection profiles that never select them. Extraction then exits early.
- No workaround for the 00:40 stall besides a longer rescan interval.

## Draft reply

> Thanks for the debug log, it pinned both freezes down. They are two separate problems, and both are new in 2026.11.2.
>
> - **00:40:** when a large TV library finishes scanning, Tunarr runs a database query that blocks the server for about 13 seconds on your library. We have a fix that brings it under a second.
> - **00:00:** the hourly subtitle preparation step now also checks every filler program. On your bumper lists it holds up the server for several seconds, and at midnight two copies run at once. That doubles the stall. We have a fix for that too.
>
> The "UNIQUE constraint failed" errors come from Jellyfin collections that appear in more than one library. They are already fixed for the next release, and they are not related to the freezes.
>
> The scan time can't be changed yet. #2070 tracks that. Moving the scan would not stop the midnight freeze anyway, because that one comes from subtitle preparation. If you don't use subtitles, setting your stream selection profiles to never pick subtitles avoids the midnight freeze until the fix ships.
