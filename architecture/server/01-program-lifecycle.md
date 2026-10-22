# 01 — One program lifecycle module

Status: **Deep dive complete · plan recorded · not implemented**
Date: 2026-09-13 · Scope: `@tunarr/server` · Candidate A of the second-pass review (see [README.md](./README.md))

## Context

Programs and groupings move from present, to **missing**, to **purged** (terms in [`CONTEXT.md`](/CONTEXT.md)). Only purge from trash has an owning module: `EmptyTrashService`, built on branch `feat/incremental-empty-trash` (PR #2072).

## Friction

### Mark missing

- 10 scanner files make 18 state writes and 14 search-index writes, paired by hand
- Pairs match today; nothing guards a future copy
- Remote TV and music scanners write groupings and programs in two calls, then one index call
- Remote scanners detect by diffing stored rows against the seen set; local scanners check each program's file
- Descendant expansion exists only in remote scanners: missing show → seasons + episodes, missing season → episodes, missing album → tracks
- No local scanner marks groupings missing, so local shows, seasons and albums never reach trash
- No scanner marks a grouping missing when all its children are missing

### Restore

- No explicit step
- Program upsert writes `state` through its update clause (`programQueryHelpers.ts:87`)
- Grouping upsert writes `state: incoming.state` (`ProgramGroupingUpsertRepository.ts:273`)
- Search re-index writes `state: 'ok'`

### Trash

- The trash page lists through `POST /programs/search` via `LibraryProgramGrid` — Meilisearch pages, SQLite hydrates
- `GET /trash` (`trashApi.ts:15-71`) has no web caller; only the generated client references it
- Count reads SQLite (`ProgramStateRepository.countMissingPrograms`)

### Purge paths

| Path                       | Lineups rewritten | Search cleaned | Batched, resumable | Status                                                                                    |
| -------------------------- | ----------------- | -------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Empty trash                | First             | Yes            | Yes                | `EmptyTrashService` (this branch)                                                         |
| Library missing on refresh | —                 | —              | —                  | No longer a purge after PR #2086                                                          |
| Remove local folder        | No                | No             | No, FK cascade     | Live on `main` since PR #2068 repaired the where clause; #2088 changes it to mark missing |
| Delete media source        | After row delete  | Yes            | No                 | `mediaSourceDB.ts:135-190`, shared-program TODO at `:140-144`                             |

### Foreign keys

- `program.media_source_id` and `program.library_id` cascade on delete
- `program_grouping.media_source_id` and `program_grouping.library_id` cascade on delete
- `media_source_library.media_source_id` cascades on delete
- `program_external_id.media_source_id` cascades on delete
- Deleting a source or library row therefore purges its programs in one statement, with no lineup rewrite

### Tests today

- `EmptyTrashService.test.ts` runs real SQLite and a real `ProgramStateRepository`
- It mocks `removeProgramsFromAllLineups`, search `deleteByIds`, and `GlobalScheduler` via `vi.mock`
- No test harness runs Meilisearch; `testing/fakes` holds only `entityCreators.ts`
- `ChannelDB.test.ts:37-114` already builds a real `LineupRepository` over a temp directory

## Design tree (decisions)

| #   | Branch                     | Chosen                                                                                                         | Rejected                                                               | Why                                                                                                                          |
| --- | -------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Module scope               | Mark missing, trash purge, scoped purges                                                                       | Mark missing + trash purge; trash purge only                           | Locality; retires the unguarded source purge                                                                                 |
| 2   | Scoped purge execution     | Scoped drain, row deleted last                                                                                 | Mark missing then drain trash; synchronous shared phases; out of scope | Cascade never fires on live data; no server stall; resumable                                                                 |
| 3   | Durable marker             | `purge_requested_at` column on `media_source`                                                                  | Purge request table; settings JSON queue                               | Gates read the row they already load; deleting the row removes the marker; mirrors #2086's `unavailable_since`               |
| 4   | Mark-missing seam          | Scanners detect; module expands down to descendants and rolls up to groupings with no present children         | Expand down only; module owns detection                                | Detection genuinely differs by source type; expansion rules are shared and missing locally; rescan upserts restore groupings |
| 5   | Trash list source          | Meilisearch for browsing, SQLite for purge; delete unused `GET /trash`                                         | SQLite for both                                                        | Trash page reuses `LibraryProgramGrid`; module writes both stores, so they cannot drift independently                        |
| 6   | Programs on two sources    | Purge replaces lineup entries with flex; remap deferred                                                        | Remap to another source's copy                                         | Each program row belongs to one source; no cross-source matching exists; external-ID rows cascade                            |
| 7   | Guide rebuild and progress | Two injected ports: `channelsChanged` and a progress emitter; `empty_trash` event becomes `purge` with a scope | `GlobalScheduler` inline plus a second event; build candidate B first  | Prod and test adapters justify the seam; B later swaps the `channelsChanged` adapter; web handles one event                  |
| 8   | Test surface               | Real SQLite and real lineup files; fake search and fake ports                                                  | Mock lineups and search; real Meilisearch                              | Lineups-before-rows is the drain's reason to exist and must be asserted for real; no Meilisearch harness exists              |
| 9   | Name and location          | `ProgramLifecycleService`; `ProgramStateRepository` becomes its private query code                             | Keep `EmptyTrashService` name; split mark and purge modules            | One interface covers the lifecycle; splitting recreates the shallow pair                                                     |
| 10  | Local folder removal       | Mark the library's programs and groupings missing; flag the library row; content reaches trash (#2088)         | Library-scoped purge                                                   | A config change should never destroy content; matches #2086's stance on missing libraries; drops the library purge scope     |

### Consequences

- Purge takes the per-library `EntityMutex` lock and aborts in-flight scans through `MediaSourceScanCoordinator.signalById`
- New scans fail to acquire the lock while a purge holds it
- Trash keeps `pendingOperations.emptyTrashRequestedAt`; resume checks the flag and the column
- One drain runs at a time; after each drain the module picks up any remaining marked scope
- `DELETE /media-sources/:id` returns 202 and runs in the background
- The web shows a deleting state for the source
- `updateProgramsState` and `updateGroupingsState` leave `IProgramDB` and `ProgramDB`
- `checkpointAndOptimize` leaves the lifecycle module; it is database maintenance
- `removeProgramsFromAllLineups` returns changed channel IDs instead of a count, so `channelsChanged` can name them

## Interface sketch

Provisional. Confirm names and shapes at implementation.

```ts
type PurgeScope =
  | { type: 'trash' }
  | { type: 'media_source'; id: MediaSourceId };

// ProgramLifecycleService
markMissing(ids: { programIds: string[]; groupingIds: string[] }): Promise<void>
requestPurge(scope: PurgeScope): Promise<PurgeStatus>
cancelPurge(): PurgeStatus
getStatus(): PurgeStatus
resumePending(): void

// Ports
type ChannelsChanged = (channelIds: string[]) => void;
type PurgeProgressEmitter = (progress: PurgeProgress) => void;
```

## Implementation plan

0. Merge `main` into `dev` so this work sees PR #2068 (and PR #2086 once merged); renumber the colliding `0045` migrations
1. Rename `EmptyTrashService` to `ProgramLifecycleService`; inject `ChannelsChanged` (adapter runs `UpdateXmlTvTask`) and `PurgeProgressEmitter` (adapter pushes to `EventService`)
2. Replace the `empty_trash` event with `purge` carrying a scope in `types/src/schemas/eventSchema.ts`; update `web/src/hooks/useEmptyTrash.ts`
3. Rewrite `EmptyTrashService.test.ts` against real SQLite, a temp-dir `LineupRepository`, a fake search adapter and fake ports; delete the trash-primitive tests in `ProgramDB.test.ts` once covered
4. Add `markMissing` with down-expansion and roll-up, one SQLite transaction and one index write; test both directions and restore-by-upsert
5. Migrate the 10 scanner files to `markMissing`; remove `updateProgramsState` and `updateGroupingsState` from `IProgramDB` and `ProgramDB`
6. Add migration `0048` with `purge_requested_at` on `media_source`
7. Parameterize the drain by `PurgeScope`; take library locks, abort scans (add a per-library cancel to `MediaSourceScanCoordinator`), delete the source row last; resume from the columns and the trash flag
8. Route `DeleteMediaSourceCommand` through `requestPurge` (local folder removal is fixed separately by #2088); return 202; delete the program and grouping deletes in `mediaSourceDB.deleteMediaSource`; drop the guide trigger from the `mediaSourceApi.ts` delete handler
9. Gate scans, library refresh and API responses on `purge_requested_at`; add a deleting badge in the web
10. Delete `GET /trash`; move `checkpointAndOptimize` out; regenerate the OpenAPI spec and web client
11. Update `docs/configure/library/trash.md` and media source docs; run `pnpm lint-changed`, `pnpm turbo typecheck`, `pnpm turbo test`

## Open at implementation

- Cancel semantics for scoped purges — lineups are rewritten before any row is deleted, so a cancelled source purge leaves flexed lineups and a surviving source; likely make source and library purges non-cancellable once lineups are rewritten
- Whether roll-up runs inside `markMissing` only, or also as a sweep for groupings already stranded `ok` by past local scans

## Out of scope

- Candidate B — the channel programming commit; it replaces the `channelsChanged` adapter later
- Old candidate #12 — injecting `GlobalScheduler`
- Remapping lineup entries to another source's copy of a program
- PR #2086 — the library refresh path; it already stops purging

## Cross-branch notes

- PR #2086 adds migration `0045_gifted_thena` on `main`, which collides with `dev`'s `0045_lean_violations`
- This branch is at `0047`; the marker column becomes `0048`
- PR #2072 (this branch) should merge before implementation starts
