# Library Scan Schedule (#2405, #2070)

> **Status (11/13/2026):** Built on branch `feat/library-scan-schedule`, not yet opened as a PR. Sync behavior and global scope settled 11/13/2026. The design below describes what was built. "Changes during the build" lists where it departs from the scoped version.

Issues:

- https://github.com/chrisbenincasa/tunarr/issues/2405 asks for an off switch for scheduled library scans, with weekly as a fallback.
- https://github.com/chrisbenincasa/tunarr/issues/2070 asks for a cron expression so scans can start at a time other than midnight.

Both issues come down to one setting. This plan replaces the hours-only interval with a schedule that can be off, an hourly interval, chosen days at a chosen time, or a cron expression.

## Current state

- Setting: `rescanIntervalHours`, default 6, `types/src/schemas/settingsSchemas.ts:214`. Validation is `nonnegative()`, so `0` passes.
- Converted by `hoursCrontab(hours, minute)` to `0 {minute} */{hours} * * *`, `server/src/services/Scheduler.ts:188`.
- Three tasks read it, all in `server/src/services/startup/ScheduleJobsStartupTask.ts`:
  - `ScanLibrariesTask` at minute 30 (`:103`). The offset keeps scans clear of the hourly `RefreshMediaSourceLibraryTask` at minute 0.
  - `SyncCollectionsTask` at minute 0 (`:118`)
  - `SyncCustomShowsTask` at minute 0 (`:130`). It syncs playlists linked to media server playlists.
- The scan task queues every local source and every enabled remote library. Per-library scan buttons call the scan coordinator directly and don't use the scheduler.
- UI: one number field, `web/src/pages/settings/ScannerSettingsPage.tsx:69`.
- API: `PUT /api/settings/media-source`, `server/src/api/settingsApi.ts:22`.

## Defects in the current behavior

Checked against node-schedule on 11/13/2026, except the last two rows, which come from reading the code.

| Input              | Cron               | Actual behavior                                                                                          |
| ------------------ | ------------------ | -------------------------------------------------------------------------------------------------------- |
| 24                 | `0 30 */24 * * *`  | Daily at 00:30. Fine.                                                                                    |
| 168 (weekly)       | `0 30 */168 * * *` | Daily at 00:30. Hours past 23 never match.                                                               |
| 5                  | `0 30 */5 * * *`   | 00:30, 05:30 … 20:30, then 00:30. Gaps reset at midnight.                                                |
| 0                  | `0 30 */0 * * *`   | node-schedule returns `null` and nothing is scheduled.                                                   |
| 0, then open Tasks | n/a                | `nextExecution()` calls `null.nextInvocation()`, so `GET /api/tasks` throws (`tasksApi.ts:46`). Not run. |
| Any change         | n/a                | Saving does not reschedule. The new interval applies only after a restart.                               |

The reporter on #2405 set 24 hours, which is the longest interval that works.

The existing backup schedule type (`EveryScheduleSchema`, converted by `scheduleRuleToCronString`, `server/src/util/schedulingUtil.ts:56`) has its own bugs. "Every 1 week at 03:00" becomes `0 3 1 * *`, which runs monthly. "Every 7 days" becomes `0 3 1,8,15,22,29 * *`, which resets on the 1st. The backup UI offers only hours and days, so neither bug reaches users today.

## Decisions

| Question                     | Decision                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schedule shape               | New `LibraryScanScheduleSchema` with four variants. Don't reuse `EveryScheduleSchema` because of the bugs above and because it has no day-of-week. |
| Collection and playlist sync | Follow the scan schedule, on the same cron. Off turns them off too. Settled 11/13/2026.                                                            |
| Scope of the schedule        | Global only, designed so per-source can be added later. Settled 11/13/2026.                                                                        |
| Migration                    | Convert `rescanIntervalHours` when the settings file is read, keeping today's fire times exactly.                                                  |
| Apply on save                | Reschedule immediately, as `scheduleBackupJobs` already does for backups.                                                                          |
| Target branch                | `main`. Small to medium feature with a settings migration.                                                                                         |

## Changes during the build

- **No migration flag.** Zod strips unknown keys, so `rescanIntervalHours` would vanish on the first parse, before a flag-gated step could read it. A `z.preprocess` on `settings.mediaSource` converts it during the parse instead. The main thread writes the file at startup, which drops the old key.
- **`days` stores `hour` and `minute` numbers**, not an `HH:mm` string. That matches `interval` and needs no regex.
- **Sync tasks share the scan's cron exactly.** Shifting their minute to 0 would mean rewriting user cron expressions. Default installs see sync move from :00 to :30.
- **`ScheduledTask` does not throw on a null job.** node-schedule also returns `null` for a `Date` in the past, so throwing would break `OneOffTask`. `scheduleLibraryScanJobs` validates the cron and schedules nothing, with an error log, when it is invalid.
- **`scheduleLibraryScanJobs` lives in `server/src/services/libraryScanSchedule.ts`**, not `Scheduler.ts`, so `Scheduler.ts` doesn't import task modules.
- **Weekdays use checkboxes.** `ToggleButtonGroup` is banned outside `components/ui/`, and `Segmented` is single-choice.
- **The cron field has an example in its help text** instead of a link to an outside cron reference.

## Design

### Schema (`types/src/schemas/settingsSchemas.ts`)

```ts
export const LibraryScanIntervalHours = [1, 2, 3, 4, 6, 8, 12] as const;

export const LibraryScanScheduleSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('off') }),
  z.object({
    type: z.literal('interval'),
    hours: z.literal(LibraryScanIntervalHours),
    minute: z.int().min(0).max(59),
  }),
  z.object({
    type: z.literal('days'),
    daysOfWeek: z.array(z.int().min(0).max(6)).min(1),
    hour: z.int().min(0).max(23),
    minute: z.int().min(0).max(59),
  }),
  CronScheduleSchema,
]);

export const GlobalMediaSourceSettingsSchema = z.object({
  scanSchedule: LibraryScanScheduleSchema.default({
    type: 'interval',
    hours: 6,
    minute: 30,
  }),
});
```

- `interval` allows only divisors of 24, so gaps stay even across midnight.
- `days` covers both daily (all seven days) and weekly (one day). 0 is Sunday, as in cron.
- `cron` reuses `CronScheduleSchema` from `utilSchemas.ts`. The `types` package has no cron parser, so the server validates the expression.

### Server

- `server/src/util/schedulingUtil.ts`:
  - `libraryScanScheduleToCron(schedule)` returns the cron string, or `null` for `off`.
  - `isValidCronExpression(expression)` checks with `cron-parser`, the parser node-schedule uses.
  - `legacyRescanIntervalToSchedule(hours)` maps the old setting (table below).
- `scheduleLibraryScanJobs(schedule)` in `server/src/services/libraryScanSchedule.ts`:
  - Calls `clearTasks` for the scan, collection-sync, and playlist-sync IDs.
  - Schedules nothing when the schedule is `off`, or when the cron is invalid.
  - Schedules all three tasks on the same cron.
- `ScheduleJobsStartupTask` calls `scheduleLibraryScanJobs` in place of its three hard-coded blocks.
- `ScanLibrariesTask` takes an optional `{ mediaSourceIds?: string[] }` input through `taskDef`, as `UpdateXmlTvTask` does. Omitted means every source, which is the only form the global job uses.
- `PUT /api/settings/media-source`:
  - Returns 400 `{ message }` for an invalid cron expression, without saving.
  - Calls `scheduleLibraryScanJobs` after saving.
- Manual runs keep working when scans are off. `POST /api/tasks/:id/run` builds the task from the registry and doesn't need a scheduled job.
- `GET /api/tasks` already tolerates a task with no scheduled jobs, so it reports no next run for the scan task.

### Settings migration

- `SettingsSchema.mediaSource` is `z.preprocess(migrateLegacyMediaSourceSettings, GlobalMediaSourceSettingsSchema)` in `server/src/db/SettingsDB.ts`.
- It converts only when `rescanIntervalHours` is present and `scanSchedule` is not.

| Old value                        | New schedule                                    |
| -------------------------------- | ----------------------------------------------- |
| Divisor of 24 below 24           | `interval`, same hours, minute 30               |
| 24 or more                       | `days`, all seven days, 00:30                   |
| 0 or a fraction                  | `off`. Neither produced a valid cron before.    |
| Any other whole number (5, 7, …) | `cron` with the exact string it produced before |

### Web (`ScannerSettingsPage.tsx`)

- A "Scheduled scans" select with Off, Every few hours, On selected days, and Custom (cron).
- Fields per choice:
  - Every few hours: frequency select and minute field
  - On selected days: weekday checkboxes, ordered by the locale's first day of the week, and a time picker
  - Custom: cron text field with an example in the help text
- The form keeps flat state for every type (`scanScheduleForm.ts`), so switching types keeps what the user entered.
- A line under the form reads "Next scan: <date>" or says scheduled scans are off. It comes from `nextExecutionEpoch` for `ScanLibrariesTask` in `GET /api/tasks`, refetched after save.
- A server 400 message shows in the error snackbar.
- Help text explains that collection and playlist sync follow this schedule.

### Docs

- New "Scheduled Scans" section in `docs/configure/media_sources/index.md`.
- `docs/configure/library/playlists.md` points to the new setting.

### Path to per-source schedules

Per-source schedules are out of scope, but this design keeps them additive. The later change would add a column and a loop, with no settings migration and no schema change to the global setting.

Choices made now for that reason:

- `LibraryScanScheduleSchema` stands alone and does not depend on the settings file. The same JSON can later live in a nullable `media_source.scan_schedule` column.
- `ScanLibrariesTask` accepts `mediaSourceIds` from day one, so a per-source job reuses the task unchanged. It also lets "run now" target one source.
- The scheduler already stores a list of jobs per task ID (`#scheduledJobsById`), and backups already use several jobs under one ID. Per-source scan jobs fit the same slot.
- All scan scheduling goes through `scheduleLibraryScanJobs`, so per-source logic lands in one function.

The later change:

| Piece        | Change                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| DB           | Nullable `scan_schedule` JSON column on `media_source`. `null` means the source follows the global schedule.                                 |
| Scheduling   | One job for the global schedule over sources with `null`, plus one job per source with its own schedule, passing that source's ID.           |
| Rescheduling | `Scheduler` needs to remove one job by key. Today `clearTasks` clears every job under an ID, which is fine while one function owns them all. |
| Sync tasks   | Stay on the global schedule. Collections and playlists are not tied to one source's scan.                                                    |
| UI           | A "Scan schedule" control on the media source edit page, defaulting to "Use global schedule".                                                |

The sync tasks stay global in both phases, so `scheduleLibraryScanJobs` should derive their jobs from the global schedule only.

## Tests

- `libraryScanScheduleToCron`, `legacyRescanIntervalToSchedule`, `isValidCronExpression`: one case per variant or mapping row.
- Migration: each row of the mapping table, a saved `scanSchedule` winning over a leftover `rescanIntervalHours`, the old key dropped from the file at startup, and the fresh-install default.
- `scheduleLibraryScanJobs`: all three tasks share the cron, `off` and an invalid cron leave no jobs, and a second call replaces jobs rather than adding to them.
- Settings API: a valid save reschedules, an invalid cron returns 400 without saving, and an interval that doesn't divide 24 fails validation.
- `ScanLibrariesTask`: with `mediaSourceIds`, it queues only those sources. Without it, it queues every source.
- Web: the form round-trips each variant. The page keeps its route, so the e2e route list needs no change.

## Risks

- A custom cron at minute 0 can start a scan while the hourly library refresh runs. The minute-30 offset came from the #1973 fix (`8ffe02d57`) as a precaution. From reading the code, an overlapping scan can act on availability that is one refresh stale. It may queue a library that is about to be marked unavailable, or skip one that is about to return. The next scan corrects either case. The presets default to minute 30. Not reproduced. If it turns out to matter, have the scan task wait for a running refresh.
- Users who rely on sync tasks while turning scans off lose automatic playlist and collection sync. The help text has to say so. A separate sync schedule can come later if users ask.

## Open questions

1. Should "Off" also skip the scan the coordinator runs when a new library is enabled? Proposed: no, because that scan is user-initiated.

## Out of scope

- Fix the `every` week and day bugs in `scheduleRuleToCronString`. They are latent for backups and need a separate small PR.
- Make unchanged local scans cheaper. That work is tracked in #2209 and #2407. The reporter's NAS load likely comes from the local scan cost, so the off switch treats the symptom and those issues treat the cause.
- Per-source and per-library schedules. These would let a Plex library scan every few hours while a large local library stays off.
- Watch the file system to scan local sources on change.
