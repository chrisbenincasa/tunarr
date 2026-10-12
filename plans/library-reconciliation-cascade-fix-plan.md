# Fix silent cascade deletion of programs & schedules during library reconciliation (GitHub #1973)

Status: revised after design review · Issue: https://github.com/chrisbenincasa/tunarr/issues/1973

## Goal & success criteria

Eliminate the data-loss path where `RefreshMediaSourceLibraryTask` treats a library absent from a
media-server API response as "removed" and hard-deletes it, cascading through `program` and
`channel_programs`. Also close the sibling path discovered during review, where an unscannable
library's programs are mass-marked `missing` and then hard-deleted by the trash endpoint without
lineup invalidation.

Success criteria:

1. Running the reporter's scenario (Plex response missing a stored library — e.g. restricted token)
   deletes **zero** `program` and **zero** `channel_programs` rows; the library row is retained and
   marked unavailable; a **warn**-level log is emitted with affected counts.
2. Empty, partial, or failed API responses never mutate the library/program tables.
3. A library that reappears is marked available again without touching the user's `enabled` preference.
4. An unavailable library is never scheduled for scanning, so its programs are never mass-marked
   `state: 'missing'`.
5. Every code path that deletes `program` rows — `DeleteMediaSourceCommand` and `DELETE /trash` —
   runs lineup removal and a guide rebuild, so `programCount` in `/api/channels` stays accurate.
6. `pnpm turbo test`, `pnpm turbo typecheck`, and `pnpm lint-changed` pass; lands as a single `fix:`
   PR on `main`.

## Design decisions (chosen, with rationale)

- **Never auto-delete libraries during reconciliation.** "Absent from one API response" is unreliable
  evidence of removal (token scope change, transient server state, proxies). Mark the library
  unavailable instead; delete only via explicit user action (which currently means media-source
  deletion).
- **Track availability separately from user intent.** Reusing `enabled` would clobber the user's
  preference when a library returns. Add a nullable `unavailable_since` column; `enabled` remains
  user-owned. The timestamp (rather than a boolean or a `state` enum mirroring `ProgramStates`)
  carries both the fact and the "since when" the UI needs.
- **No FK change.** The earlier draft proposed flipping `program.library_id` and
  `program_grouping.library_id` from `onDelete: 'cascade'` to `'set null'`. **Dropped.** Rationale:
  `program.mediaSourceId` already carries its own `onDelete: 'cascade'`, so media-source deletion
  wipes programs regardless; after this fix the only library-only delete left is the Jellyfin dupe
  path, which now repoints references explicitly (so set-null would never fire); a null `libraryId`
  is a degraded state that `JellyfinItemFinder.ts:78` can only report as unrecoverable; and it would
  arguably make a *future* explicit "remove library" feature wrong. Not worth rebuilding the largest
  table in every user's DB for defense against code that does not exist.
- **Gate scanning at the coordinator, not the callers.** `MediaSourceScanCoordinator.add()` already
  performs a fresh `getLibrary(libraryId)` read and is the single choke point every scan request
  passes through, including the manual API endpoint. One gate there replaces two caller-side checks
  and covers future callers.
- **Unify the three backend handlers before adding logic to them.** `handlePlex`, `handleJellyfin`
  and `handleEmby` have already drifted, and that drift is the bug's shape (see table below). Adding
  the new logic three times would preserve the conditions that produced it.
- **Jellyfin duplicate libraries:** repoint references to the kept row before deleting the duplicate.
  With the FK still `cascade`, this repoint is load-bearing, not hardening.
- **Program deletion side effects belong in one place.** Extract `ProgramDeletionSideEffects` so the
  lineup-removal + guide-rebuild contract cannot be forgotten by a third deletion path.

### Handler drift (the thing being unified)

| | supported-type filter | empty guard | update set | dupe handling |
|---|---|---|---|---|
| `handlePlex` | yes | **no** | name + mediaType | no |
| `handleJellyfin` | yes | **no** | **`[]`** (commented out) | yes |
| `handleEmby` | yes | yes, but on **pre-filter** `Items.length` | **`[]`** | no |

Consequences today: Emby's guard misses the "only unsupported types returned" case; Jellyfin and Emby
never sync library renames; and there is nowhere for the "clear `unavailableSince` on reappearance"
logic to hang on two of three backends.

## Implementation steps

### 1. Schema + migration

- **1a.** `server/src/db/schema/MediaSourceLibrary.ts`: add
  `unavailableSince: integer({ mode: 'timestamp_ms' })` to the table and to
  `MediaSourceLibraryColumns`.
- **1b.** Generate and register the migration using the repo's standard path (per the `new-migration`
  skill; the hand-written `Migration####_Name.ts` class is the exception pattern and is not needed
  for a plain `ADD COLUMN`):
  1. `cd server && pnpm drizzle-kit generate` → produces `server/src/migration/db/sql/00NN_*.sql`
     containing `ALTER TABLE media_source_library ADD COLUMN unavailable_since integer;`
  2. `date +%s` for the key.
  3. Append to the END of `getMigrations()` in `server/src/migration/DirectMigrationProvider.ts`:
     `migration<TIMESTAMP>: makeMigrationFromSqlFile('./sql/00NN_*.sql'),`
  4. Review the generated SQL before committing — drizzle-kit sometimes emits destructive statements.
- Note: `channel_programs.program_uuid` FK stays `onDelete: 'cascade'` — deleting a *program* should
  still remove its schedule rows. All library FKs stay `cascade` as they are today.

### 2. Extract a shared reconcile function — `server/src/services/MediaSourceLibraryRefresher.ts`

Each handler becomes a thin adapter: fetch, map the backend response to a normalized
`{ externalKey, name, mediaType }[]` (dropping unsupported types), and hand it plus a backend label
to one shared `reconcileLibraries`. All behavior below lives in that one function.

- **2a. Post-filter empty guard.** If the normalized list is empty while the stored source has ≥1
  library, log an `error` (mention possible restricted token / transient server state, and that
  stored libraries were left untouched) and return without calling `updateLibraries`. This is
  strictly stronger than Emby's current guard, which tests raw `Items.length` *before* the
  supported-type filter and so misses "only unsupported types returned".
- **2b. Missing libraries → mark unavailable, never delete.** For each stored library absent from the
  incoming keys, add `{ uuid, unavailableSince: now }` to `librariesToMarkUnavailable`, preserving an
  already-set value. Never touch `enabled`. `deletedLibraries` is no longer populated from this set.
- **2c. Reappearing libraries → mark available.** Stored libraries present in the incoming keys whose
  `unavailableSince` is set go into `librariesToMarkAvailable: string[]` (clears the field, keeps
  `enabled`). Because reconcile is now shared, Jellyfin and Emby gain a real intersection/update set
  for the first time — which also fixes library renames never syncing on those backends.
- **2d. Jellyfin duplicates.** Detect duplicate `externalKey` rows, then in one transaction repoint
  `program.library_id` and `program_grouping.library_id` from each dupe uuid to the kept uuid, then
  delete the dupe rows. **This is mandatory, not hardening** — the library FK still cascades, so an
  unrepointed dupe delete reproduces the exact bug being fixed. Collision risk checked: `program`'s
  unique index is on `(sourceType, mediaSourceId, externalKey)`, not `libraryId`, so the repoint
  cannot violate it.
- **2e.** Keep the existing add-new-libraries behavior (`enabled: false` on add).
- **2f. Transition-only logging.** Emit the `warn` only when `unavailableSince` goes null → set, and
  an `info` on the reverse transition. Message:
  `"Library '<name>' (key '<externalKey>') of media source '<id>' is missing from the <backend> response; marking unavailable (N programs, M channel schedule entries preserved)"`.
  Steady state must cost nothing — a permanently-removed library must not pay for the counts query
  every hour forever.

### 3. DB layer — `server/src/db/mediaSourceDB.ts`

- Extend `MediaSourceLibrariesUpdate` with
  `unavailableLibraries: { uuid: string; unavailableSince: number }[]` and
  `availableLibraries: string[]`.
- `updateLibraries` transaction: apply the unavailable/available sets; when `deletedLibraries` is
  non-empty (now only the Jellyfin-dupe path) log a `warn` with the uuids.
- Add `repointLibraryReferences(fromUuids: string[], toUuid: string)` (two
  `UPDATE … SET library_id = to WHERE library_id IN from` statements), executed in the same
  transaction as the dupe delete.
- Add `getLibraryReferenceCounts(uuids: string[]): Promise<{ libraryUuid: string; programCount: number; groupingCount: number; channelProgramCount: number }[]>`
  (drizzle `inArray` against `program.libraryId`, `programGrouping.libraryId`, and
  `channel_programs ⋈ program`). **Called only on the unavailable transition**, never on steady state.

### 4. Scan gating + cron collision

- **4a.** Gate in `MediaSourceScanCoordinator.add()` (around the existing `getLibrary` at line 124):
  skip and return `false` when `library.unavailableSince !== undefined`, logging at `debug`. This
  replaces the two caller-side checks the earlier draft proposed in `ScanLibrariesTask.ts:52` and
  `mediaSourceApi.ts:~488`.
- **4b.** Offset the scan schedule. `hoursCrontab(n)` is `0 0 */n * * *`
  (`server/src/services/Scheduler.ts:187-189`), so `RefreshMediaSourceLibraryTask` (hourly) and
  `ScanLibrariesTask` (every `rescanIntervalHours`, default 6 per `settingsSchemas.ts:206`) fire at
  the same second four times a day, in the same process. `ScanLibrariesTask` snapshots libraries via
  `getAll()` up front, so gating is racy without an offset. Give the scan crontab a `:30` minute
  offset.
- Race severity is bounded even if it fires: `state` is in `ProgramUpsertSetClause`, so a rediscovered
  program resets to `'ok'` on the next successful scan. The exposure is a user seeing thousands of
  falsely-trashed items and emptying trash inside the window — which is exactly why Step 5 matters.

### 5. Program-deletion side effects (`programCount` correctness)

Audit correction: the earlier draft asserted `DeleteMediaSourceCommand` was the only program-deletion
path. It is not. `removeProgramsFromAllLineups` has **exactly one caller**
(`DeleteMediaSourceCommand.ts:27`), while `DELETE /trash` (`server/src/api/trashApi.ts:66-73`) calls
`programDB.emptyTrashPrograms()` — literally
`DELETE FROM program WHERE state = 'missing'` (`ProgramStateRepository.ts:52-54`) — plus a search
sync, with **no lineup removal and no guide rebuild**. That is a live, user-reachable instance of the
same stale-`programCount` symptom.

- **5a.** Extract `ProgramDeletionSideEffects` (a small injectable service) encapsulating the
  contract: `channelDB.removeProgramsFromAllLineups(programIds)` + search index removal + guide
  rebuild trigger (`UpdateXmlTvTask.runNow` / `guideService.refreshGuide(..., force=true)`).
- **5b.** Route `DeleteMediaSourceCommand` through it (behavior-preserving).
- **5c.** Make `emptyTrashPrograms` return the deleted program IDs (`.returning()` or a prior
  `SELECT`), and route `DELETE /trash` through the same service.
- With Steps 1–4, the refresher deletes no program rows at all, so the reconciliation path's
  `programCount` is correct by construction.

### 6. Types, API, web surface

- `types/src/schemas/settingsSchemas.ts` `BaseMediaSourceLibrarySchema`: add
  `unavailableSince: z.number().optional()`.
- `server/src/api/mediaSourceApi.ts` library converters (lines ~156–166, ~284–296, ~931–941,
  ~963–973): map `unavailableSince: nullToUndefined(library.unavailableSince)?.valueOf()`.
- Regenerate contracts: `cd server && pnpm generate-openapi`, then `cd web && pnpm generate-client`.
- `web/src/components/MediaSourceLibraryTable.tsx` and `EditMediaSourceLibrariesDialog.tsx`: render an
  "Unavailable since &lt;date&gt;" badge with a tooltip explaining the server did not report the
  library and that programs/schedules are preserved. **Leave the enable-toggle live.** Disabling it
  would conflate user intent with server reality — the exact separation this design rests on — and
  would block a user from pre-enabling a library they know is returning. The coordinator gate already
  prevents useless scans.
- Both surfaces need the badge: `MediaSourceLibraryTable` filters to `lib.enabled` and is where a user
  looks when scans stop, so omitting it there is where the silence hurts most.

### 7. Tests

- **7a. Pure reconcile tests** — new `server/src/services/reconcileLibraries.test.ts`. Because
  reconcile is now a pure function over normalized input, these need no container and no
  `MediaSourceApiFactory` mock:
  1. Stored library absent from response → appears in `unavailableLibraries`, `deletedLibraries`
     empty.
  2. Library reappears → appears in `availableLibraries`; stored `enabled: false` preserved.
  3. Empty normalized list with existing stored libraries → guard trips, no update emitted.
  4. Only unsupported types returned → post-filter emptiness trips the same guard.
  5. Genuinely new library still added with `enabled: false` (regression).
  6. Idempotence: a second run over the same missing library emits no new warn transition.
- **7b. Handler wiring** — one container-based test per backend (`containerLikeProduction` pattern
  from `server/src/services/OnDemandChannelService.test.ts`) proving each handler normalizes its
  response and calls reconcile, including the API-failure early return.
- **7c. Jellyfin dupe** — duplicate `externalKey` → repoint called for the dupe uuids, then dupe
  deleted, and the kept library's program count is the union.
- **7d. Trash integration** — new test using the `copyPreMigratedDb` / `DBAccess` pattern from
  `server/src/db/TagRepo.test.ts` and `server/src/testing/testDbFactory.ts`: seed a channel with
  programs in its lineup, mark them `missing`, empty trash, assert the lineup no longer references
  them and the derived `programCount` is correct. This replaces the earlier draft's
  `MediaSourceLibraryCascade.test.ts` — its `PRAGMA foreign_key_list` and cascade-survival assertions
  are moot now that no FK changes and reconciliation deletes nothing.
- **7e.** Run `pnpm turbo test`, `pnpm turbo typecheck`, `pnpm lint-changed`. `globalTestSetup`
  applies all migrations to a fresh DB, so migration validity is exercised implicitly.

### 8. Documentation

- `docs/configure/media_sources/plex.md` (lines 24–38 describe the sync loop) and the `jellyfin.md` /
  `emby.md` equivalents: state that a library absent from a server response is marked unavailable, not
  deleted; that its programs and channel schedules are preserved; that it is skipped for scanning
  while unavailable; and that it resumes automatically when it returns, with the user's enable/disable
  choice untouched.
- `docs/misc/troubleshooting.md` (and/or `common-issues.md`): add a "my library shows Unavailable"
  entry pointing at token scope and server reachability as the usual causes.

## Edge cases & failure modes

- **Plex returns empty at startup (server still booting):** guard skips reconciliation entirely — no
  churn, no false "unavailable" marks.
- **Library missing on one run, present on the next:** `unavailableSince` set then cleared; `enabled`
  untouched; scans resume automatically.
- **Restricted token returning a partial list (the reporter's literal case):** the guard does not trip,
  and the missing subset is marked unavailable and gated out of scanning. This is the intended
  outcome — marking is non-destructive and self-reversing, so no partial-loss threshold heuristic is
  warranted.
- **User-disabled library goes missing and returns:** stays disabled (user intent preserved).
- **Library permanently removed from Plex:** row persists, marked unavailable, programs/schedules
  preserved. Steady-state cost is zero because logging and counts are transition-only. Cleanup becomes
  a future explicit-user feature, not an automatic side effect.
- **Hourly task idempotence:** unavailable/available marks are idempotent; warn emitted only on state
  change.
- **Concurrent startup tasks:** `RefreshLibrariesStartupTask` has `dependencies = []` and
  `StartupService` starts independent tasks concurrently — now harmless, since reconciliation performs
  no destructive writes.
- **Playback of an unavailable library's programs:** they remain in lineups and may fail to stream if
  the token genuinely cannot reach them. This is not a regression: today the program row is deleted
  while the disk-cached lineup still lists it, so playback already breaks — but irrecoverably. This
  fix strictly improves on that.

## Out of scope (file as follow-ups)

- **Scanner empty-response guard.** `MediaSourceMovieLibraryScanner.ts:162-174` runs an unguarded
  `differenceWith` and will mark every program in a library `state: 'missing'` if the API yields zero
  items. Step 4's gate stops the library-invisible case reaching it, but a library that is visible and
  returns empty is still exposed. Same bug class, 5+ scanner files — separate issue.
- A user-facing "remove library" endpoint/UI (post-fix cleanup path).
- UI polish beyond the availability badge.
- Changing `channel_programs` cascade semantics or the `media_source` deletion cascade.

## Assumptions

- Preserving programs/schedules through transient library invisibility is the correct default (the
  maintainer's comment endorsed investigating the general footgun beyond the pre-1.0.0 migration path).
- Warn-level logs are sufficient visibility for the initial fix; SSE/UI notifications are a possible
  follow-up.
- The whole change lands as one `fix:` PR on `main`. Every piece is a bug fix and the badge is
  explanatory UI for the fix, not a feature. Splitting the behavioral fix to `main` and the reconcile
  extraction to `dev` would mean editing the same three handlers twice and guaranteed merge rework.
  Note the hard constraint: never-delete without the scan gate is a regression (libraries stay
  `enabled`, scans run against an invisible library, everything gets mass-marked `missing`), so
  Steps 2 and 4 cannot be separated.

## Context: root-cause summary (investigation findings)

- `MediaSourceLibraryRefresher.handlePlex/handleJellyfin/handleEmby` compute
  `removedLibraries = storedKeys - apiKeys` and pass them as `deletedLibraries` to
  `MediaSourceDB.updateLibraries`, which runs a hard `DELETE FROM media_source_library`
  (`server/src/db/mediaSourceDB.ts:411-432`).
- Production schema: `program.library_id → media_source_library ON DELETE CASCADE`
  (`Program.ts:72-74`, shipped via migration 0025 in v1.0.0),
  `program_grouping.library_id → media_source_library ON DELETE CASCADE` (`ProgramGrouping.ts:80-82`),
  and `channel_programs.program_uuid → program ON DELETE CASCADE` (`ChannelPrograms.ts:16`). Verified
  empirically with an in-memory SQLite harness on the production DDL: deleting one library row removed
  its program row and the schedule row in lockstep.
- The task runs on every startup (`RefreshLibrariesStartupTask`) and hourly
  (`ScheduleJobsStartupTask`); HTTP failures return early (safe), but a 200 with an empty or partial
  `Directory` is treated as authoritative. Only Emby guards the empty case, and only pre-filter.
  Removals are logged at debug level only.
- Secondary bug: `/api/channels` `programCount` derives from disk-cached lineup JSON
  (`LineupRepository.getFileDb` → `channelConverters.ts:60`) that the cascade never invalidates,
  masking the loss.
- Sibling path found during review: scanners mark unfound programs `state: 'missing'`, which is not a
  flag but a trash bin — `DELETE /trash` hard-deletes every `missing` program, cascading to
  `channel_programs`, without lineup or guide invalidation.
