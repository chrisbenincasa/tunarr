# Smart Collections as Filler List Backing

> **Status (10/08/2026):** Proposed. Design settled (snapshot sync, `set null` on delete). No code yet. Next step: build phase 1.

Issue: [#1750](https://github.com/chrisbenincasa/tunarr/issues/1750)

## Goal

- A filler list can take its content from a smart collection.
- The list refreshes when the library changes, so users stop editing filler by hand.

## Current State

| Feature | Storage | Resolution |
|---|---|---|
| Filler list | `filler_show_content` maps a list to program rows | Plain SQL join |
| Smart collection | `smart_collection.query` holds a search string | Meilisearch query, then shows/seasons/albums expand into terminal programs |

- `StreamProgramCalculator.ts:450` calls `getFillersFromChannel` on every flex gap. This is the streaming hot path.
- Grouping expansion lives in `SlotSchedulerHelper.materializeSmartCollections` (`services/scheduling/SlotSchedulerHelper.ts:383-489`).
- `MediaSourceProgressService` emits `scanEnd(libraryId)` from every library scanner.
- `MeilisearchService.waitForPendingIndexTasks()` waits for queued program index writes. `ExternalCollectionScanner.ts:185` already calls it before querying.

## Decision

Store a snapshot. The filler list gets a `smart_collection_id`. A sync job rewrites `filler_show_content` from the collection.

| | Snapshot sync (chosen) | Resolve live (rejected) |
|---|---|---|
| Readers changed | None | 6+ (`getFillersFromChannel`, `getFillerPrograms`, `getAllFillers`, `getFillerListsByIds`, `materializeFillerLists`, `/filler-lists/:id/programs`) |
| Streaming hot path | SQL only | Meilisearch plus grouping expansion per flex gap |
| Search outage | Last snapshot keeps playing | Filler breaks |
| Freshness | Last sync | Always current |

- Cooldowns, play history, and per-list stream selection profiles key off `fillerListId` and program UUID. They keep working unchanged.
- When a smart collection is deleted, the FK uses `ON DELETE SET NULL`. The list keeps its last snapshot and becomes a manual list.

## Phases

### 1. Schema

- Add `filler_show.smart_collection_id`: nullable `text`, references `SmartCollection.uuid`, `onDelete: 'set null'`.
- Add the relation to `FillerShowRelations`.
- Generate the migration with `pnpm drizzle-kit generate` (the `new-migration` skill).

### 2. Shared materializer

- Extract the grouping expansion out of `SlotSchedulerHelper.materializeSmartCollections` into an injectable service, e.g. `SmartCollectionMaterializer`.
- Input: smart collection IDs. Output: `Record<smartCollectionId, ProgramWithRelationsOrm[]>`.
- `SlotSchedulerHelper` calls the new service. Its slot behavior must stay identical (existing slot scheduler tests cover it).

### 3. Sync service

- `FillerListSmartCollectionSync.syncList(fillerListId)`:
  1. Call `waitForPendingIndexTasks()`.
  2. Materialize the collection.
  3. Dedupe by program UUID, because the table's primary key is (list, program).
  4. Rewrite the content in one transaction, reusing the 1,000-row chunked insert in `FillerListDB`.
- `syncByCollection(smartCollectionId)` syncs every list backed by that collection.
- An empty result writes an empty list. It does not keep the old content.
- If search is down or the query fails to parse, log the error and keep the existing snapshot.

### 4. Triggers

| Event | Action |
|---|---|
| Filler list created or saved with a collection | `syncList` |
| Smart collection updated | `syncByCollection` |
| `scanEnd` | Sync every smart-backed list, debounced (e.g. 30 s) so a multi-library scan runs one sync |

- Run sync work through the existing task queue rather than inside the event handler, so a slow sync can't block scanning.

### 5. API and types

- Add optional `smartCollectionId` to the filler list Zod schemas in `@tunarr/types`.
- Create/update: if `smartCollectionId` is set, ignore or reject client `programs` and trigger a sync.
- Add an endpoint, `POST /filler-lists/:id/sync`, for a manual refresh.
- Regenerate the OpenAPI spec and web client (the `regen-api` skill).

### 6. Web

- `web/src/components/filler/EditFillerListForm.tsx`: add a source toggle, "Manual" or "Smart collection", with a collection picker.
- A smart-backed list shows its programs read-only, plus a "Refresh now" button.
- Converting a smart-backed list to manual keeps the current content as the starting point.
- The filler list table shows the backing collection's name.

### 7. Docs

- Update the filler list docs page to describe smart-collection backing and when it refreshes.

## Tests

- Materializer: show → episodes, season → episodes, movie passthrough, programs with no media source dropped.
- Sync: dedupe, empty result, failure keeps the old snapshot, programs removed from the library drop out.
- FK: deleting the collection nulls the column and keeps the content.
- Trigger: `scanEnd` debounce collapses several events into one sync.
- Slot scheduler regression: existing smart-collection slot tests still pass after the extraction.
- E2E: add a smart-backed filler list to `e2e/fixture/seed.ts`.

## Risks

- **Large collections.** A query like "all movies" becomes thousands of rows. Chunked writes handle that, but the read-only program view may need paging.
- **Sync during a long scan.** The debounce runs on `scanEnd` only, so a long scan delays the refresh until it finishes. That is acceptable.
- **Ordering.** `filler_show_content.index` follows search result order. Filler picking is weighted random, so order doesn't matter.

## Out of Scope

- Resolving live at stream time.
- Mixing a smart collection with manually added programs in one list.
- Periodic syncs not tied to a scan. Add them only if users ask.
