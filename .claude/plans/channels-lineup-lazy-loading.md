# Channel Lineup Loading, Server-Side Drafts and Program Add Flow

> **Status (09/29/2026):** Phases 0 and 1 are in open PR #2176. Part of Phase 2 is in open PR #2177 (dialogs mount only when open, memoized lineup). A 16,920-item lineup now cold-loads in 1.7 s at a 110 MB peak heap. Phase 4 is now server-side lineup drafts, chosen 09/28/2026 over a slim client payload. Phase 4 design was grilled 09/28–09/29/2026, and all open questions are settled. Next step is Phase 4a on `dev`. Phase 3 (batched add) is not started and now feeds the draft.

## Context

- A user reported that huge lineups fail to load in the channel view.
- The maintainer reproduced a related crash: a Select All add of an unfiltered TV library crashed the tab at about 8 GB.
- Two separate causes combine:
  - **#2119** (`63ebb090e`, 09/20/2026) widened program queries to `MaterializedProgramRelations`. Every episode now carries its show's full cast. On the maintainer's data that is 38 KB of a 46 KB episode.
  - **Select All** selects shows, seasons and episodes together, so each episode is added three times.
- The list is already virtualized with `react-window` (`ChannelLineupList.tsx:32`).

## Measurements (maintainer's data, 09/28/2026)

| Path | Before | After Phase 0 |
|---|---|---|
| `GET /channels/:id/programming`, 6,238 unique programs | 12.2–13.0 s, 186 MB | 0.87–0.90 s, 20.6 MB |
| `GET /programs/:id/descendants`, single episode (avg of 200) | 30.9 KB | 3.3 KB |
| Select All add, unfiltered TV library (after Phase 1) | 131 searches + 6,413 requests, 69 s, 16,920 programs | 7 searches + 240 requests, 3 s, 5,640 programs |

Cold load of the programming page in a fresh headless Chrome, 5,640 unique programs:

| | Before | After Phases 0–1 |
|---|---|---|
| Lineup request | 11.3 s, 179 MB | 0.9 s, 19.8 MB |
| Time until the list shows | 15.3–15.9 s | 2.2–2.3 s |
| Renderer JS busy | 4.2–4.4 s | 1.8–1.9 s |
| Chrome CPU, all processes | 7.0 s | 2.8–3.0 s |
| Peak JS heap | 307 MB | 125–129 MB |
| Chrome RSS growth | +620 MB | +130 MB |

A 16,920-item lineup of the same 5,640 programs cold-loads on the fixed branch in 3.4 s at a 168 MB peak heap. `materializeProgramList` (`store/selectors.ts`) is then the top JS cost at 484 ms, which is the Phase 2 target.

From a live profile of a Select All add, measured before Phase 0:

- The heap reached 357 MB, and 289 MB of it was parsed API responses held in the store.
- The list-building selectors held 12 MB and used 99 ms of CPU.
- Immer spent about 1.6 s freezing new store objects.
- The lineup contained 16,920 programs, although the user expected about 6,000.

## Phase 0: #2119 regression fix (PR #2176)

- [x] Add `LineupProgramRelations` in `server/src/db/program/programRelations.ts`. It holds external ids plus parents with their external ids.
- [x] Use it in `loadCondensedLineup`, `getProgramGroupingDescendants`, and the single-program branch of `GET /programs/:id/descendants` (new `getLineupProgramById`).
- [x] Gate Zustand devtools to dev builds (`web/src/store/index.ts`). Zustand v4 enables it in production whenever the Redux DevTools extension is present.
- [x] Typecheck, 164 server tests and lint pass.
- [x] PR #2176.
- Known tradeoff: the lineup reload again lacks genres and credits that a save response carries (the drift #2119 fixed). No lineup UI reads those fields. Phase 4 removes the mismatch.

## Phase 1: Select All duplication (PR #2176)

- [x] `defaultLibrarySearchFilter` in `web/src/helpers/programUtil.ts`, shared by `LibraryProgramGrid` and Select All.
- [x] `dedupeImportedMedia` in `useAddProgramming.ts` drops repeated imported programs within one add and keeps custom show repeats.
- [x] Tests: `helpers/programUtil.test.ts`, `hooks/programming_controls/useAddProgramming.test.ts`.


- **Cause:**
  - `enumerateSyncedItems` (`web/src/helpers/programUtil.ts:92-124`) pages `/programs/search` without the grid's default type filter (`LibraryProgramGrid.tsx:95-138`).
  - Shows, seasons and episodes are all indexed, so an unfiltered TV library returns all three.
  - `useAddProgramming.ts` expands each one through `descendants`, and nothing removes the repeats.
- **Fix:**
  - Make Select All use the same filter and sort the grid shows.
  - De-duplicate on add, skipping a program already covered by a selected ancestor. Copy the rule from `SlotSchedulerHelper.ts:433-438`.
- **Related gaps:**
  - Select All ignores the drilled-in parent context.
  - With a text query, Select All stops at Meilisearch's `maxTotalHits` (default 1,000) without telling the user.
- **Test:** an unfiltered Select All of a show library yields each episode exactly once.

## Phase 2: State management

The remaining items here only matter while the lineup lives in the browser. Phase 4 moves it to the server, so skip them unless Phase 4 stalls.

- [x] Mount the programming tool dialogs only while open (PR #2177). Closed `RemoveShowsModal` and `AddBlockShuffleModal` cost about 1.26 s per cold load.
- [x] Memoize `materializeProgramList` and `channelEditorSelector` by input identity (PR #2177). Cold load of 16,920 items went from 3.4 s to 1.7 s.
- Memoize `materializeProgramList` by `(programList, programLookup)` identity (done, see above). `useSuspendedStore` (`hooks/useSuspendedStore.ts:42`) runs the selector on every render, and 10–15 subscribers each rebuild the list.
- Store condensed items in `programList`, not full `ContentProgram` objects. `addMediaToCurrentChannel` (`store/channelEditor/actions.ts:280`) and every tool that calls `setCurrentLineup` currently push full objects. That duplicates `programLookup` and makes Immer freeze them.
- Consider `setAutoFreeze(false)` for the editor slices, or keep large lookups outside Immer.
- Replace the linear `findProgram` per rendered row (`ChannelLineupList.tsx:354`) with an index map.
- Re-measure on a 17k-item lineup with many unique programs.

## Phase 3: Batched add flow

The add flow today works like this:

- Select All pages `/programs/search` 50 at a time.
- It stores every hit as a selection and as a full object in `knownMedia`.
- It then calls `/programs/:id/descendants` once per selection, one request at a time.

`knownMedia` is only an existence check on add (`useAddProgramming.ts:39-48`).

**New endpoint:** `POST /programs/resolve`.

- **Request:** an ordered list of selection entries:
  - `{kind: 'query', mediaSourceId, libraryId?, searchRequest, parentId?}`
  - `{kind: 'ids', ids: string[]}` for programs or groupings
  - `{kind: 'custom-show', id}`
- **Server:**
  - Runs query entries through Meilisearch `getDocuments`, which has no hit cap. Smart collections already do this (`SmartCollectionsDB.ts:164-216`).
  - Expands groupings with `getProgramGroupingDescendants`.
  - Loads terminal programs in chunks with `LineupProgramRelations`.
  - De-duplicates while preserving order.
- **Response:** `{lineup: CondensedChannelProgram[], programs: Record<id, LineupProgramSummary>}`. Once Phase 4b lands, resolve runs inside the `add` draft operation and nothing returns to the browser but the operation response.
- **Client:**
  - Select All stores one `query` entry instead of expanding hits.
  - Individually toggled items become `ids` entries.
  - Add makes one call, then merges the result into the draft. Channel, custom show and filler editors all use it.
- **Out of scope:** `append: true` saves. The add merges into the draft, not the live lineup.
- **Result:** a Select All of 6k programs becomes 1 request and about 20 MB, down from about 6,550 requests.

## Phase 4: Server-side lineup drafts

The editor's working lineup moves from the browser to the server. Tools run in the worker pool against a stored draft, and the browser pages the draft instead of holding it. This replaces the earlier "slim payload" design, which kept the whole list in the browser.

### Goals

- Lineup size stops mattering to the browser. It holds one page of rows at a time.
- Tools chain naturally, because each operation applies to the draft's latest version.
- Users can see what each operation did and undo it.
- Nothing is written to the live lineup until Save.

### Prior attempt

- An earlier server-side attempt struggled with operations chained on an ephemeral schedule. The user could not see the effect of each step.
- Slot preview today is stateless (`channelsApi.ts:869`). The worker builds from the channel's saved programs, so step 2 cannot start from step 1's output.
- Drafts fix the chaining. The history panel, per-operation summaries and changed-row highlights fix the visibility.

### Data model

| Table | Columns |
|---|---|
| `lineup_draft` | `id`, `target_type` (`channel`, `custom_show`, `filler_list`), `target_id`, `base_hash`, `current_version`, `created_at`, `updated_at` |
| `lineup_draft_version` | `draft_id`, `version`, `parent_version`, `operation` (JSON), `summary` (JSON), `items` (condensed JSON), `created_at` |

- One draft per target. It is created by the first operation, not by opening the editor, so a view-only visit writes nothing. Opening an editor resumes an existing draft.
  - Chosen 09/28/2026. A draft then always means the user changed something, which is when the resume prompt and cleanup should apply.
- `base_hash` is a hash of the saved item list when the draft was created. Commit re-hashes the saved list and compares.
  - The hash covers structure only: item type and program id for content items, plus duration for flex and redirect items.
  - Chosen 09/28/2026 over timestamps or a revision counter. Custom show and filler content writes, including playlist sync, never bump `updatedAt`, so any per-writer version would miss writers.
- Content item durations are program data, not draft data. Paged reads and commit take them from `program` and recompute start offsets. Chosen 09/28/2026.
  - `ReconcileProgramDurationsTask` rewrites saved durations at playback time. A draft that stored its own durations would conflict with every fix and revert it on commit, because the manual save path trusts request durations (`LineupRepository.ts:108`).
  - `totalDuration` is computed from the join, not stored.
- Start offsets live in an in-memory LRU keyed by `(draftId, version)`, or by live hash before a draft exists. Chosen 09/29/2026.
  - The first read of a version builds the offsets array (about 140 KB at 17k items). Page and time-window reads binary-search it.
  - Any duration reconcile drops the whole cache. Reconciles are rare.
  - Offsets are not stored in version rows, because a reconcile would make them stale.
- Draft items whose program was deleted stay in place. Chosen 09/28/2026.
  - Paged reads return a "missing program" row, so indices stay stable for index-based operations.
  - The draft header shows the missing count. Commit drops those items and reports how many.
  - Drafts are not cleaned when programs are deleted, because that would rewrite history under the user.
- `items` holds condensed items only. That is 103 B per item, so about 1.7 MB per version at 17k items.
- Each version stores a full item list. History is capped at 25 versions per draft, and the oldest are pruned. Chosen 09/29/2026.
  - Most tools rewrite the whole list, so a diff would be as large as a snapshot. Measure database growth in 4a, and cut the cap or compress if it matters.
- Drafts never expire. They live until committed or discarded. Chosen 09/29/2026.
  - One draft per target and 25 versions per draft already bound storage. Expiry would silently delete unsaved work.
  - The channel, custom show and filler lists show a "draft" badge on any target with a draft. The badge becomes a warning once the draft is untouched for 30 days.
  - The editor opens a draft with a banner offering resume or discard.
  - A drafts list in Settings shows every draft with its target and age. It supports selecting many and deleting them, plus "delete drafts older than N days."
  - Deleting a channel, custom show or filler list deletes its draft.
- Operations run in the worker pool, with an in-process fallback through `NoopWorkerPool`, the same as the slot schedulers. Chosen 09/28/2026.
  - The worker reads the draft version and program summaries through its own DI container (`TunarrWorker.ts`), runs the transform and returns the new item list.
  - The main thread writes the new version. Workers never write today, and SQLite keeps a single writer.

### API

| Endpoint | Purpose |
|---|---|
| `GET /lineups/:targetType/:targetId` | Lineup state. Returns the draft's version, totals and staleness if a draft exists, else the live lineup's hash and totals. |
| `GET /lineups/:targetType/:targetId/items?version&offset&limit` | One page of items with start offsets and program summaries. Reads the draft if one exists, else the live lineup. |
| `GET /lineups/:targetType/:targetId/items?version&from&to` | Items overlapping a time window, for the calendar views. |
| `POST /lineups/:targetType/:targetId/operations` | Apply one operation. Creates the draft if none exists. Body carries `expected`. |
| `POST /lineups/:targetType/:targetId/undo`, `/redo` | Move the current version pointer. |
| `GET /lineups/:targetType/:targetId/history` | Versions with operation and summary. |
| `POST /lineups/:targetType/:targetId/commit` | Write the draft to the live lineup, then delete the draft. |
| `DELETE /lineups/:targetType/:targetId/draft` | Discard the draft. |
| `GET /lineup-drafts` | Every draft with target, age, version count and item total, for badges and the Settings list. |
| `DELETE /lineup-drafts` | Bulk discard. Body is a list of targets or `{olderThanDays}`. |

- Endpoints are keyed by target, because there is at most one draft per target and reads work with or without one.
- `expected` is either `{draftVersion}` or, before a draft exists, `{liveHash}` from the last read. A mismatch returns 409, so an index-based edit never lands on a list the user did not see.
- A new operation after an undo drops the redo branch.
- Commit returns 409 when the saved lineup hash no longer matches `base_hash`, for example after a slot schedule regeneration. The user then chooses to overwrite or discard.
- Commit reuses the existing manual lineup write path.
- `GET /channels/:id/programming` keeps its current shape and stored offsets for API users. External callers who want pages or summaries use `/lineups/...`. Chosen 09/29/2026.

### Operation response

- `version`, `totalItems`, `totalDuration`
- `summary`, for example "Removed 3,200 items from 4 shows" or "Reordered 16,920 items"
- `changedRanges`, as index ranges in the new version, capped at 100 ranges
- `firstChangedIndex`, so the view can scroll there

### Operations

Every edit becomes an operation, including manual ones. Versions are ordered, so index-based manual edits stay valid.

| Group | Operations | Source today |
|---|---|---|
| Sort | alpha, release date, episode number, random, cyclic shuffle, block shuffle | `useAlphaSort`, `useReleaseDateSort`, `useEpisodeNumberSort`, `useRandomSort`, `useCyclicShuffle`, `useBlockShuffle` |
| Remove | all, flex, specials, duplicates, selected shows | `useRemoveAllProgramming`, `useRemoveFlex`, `useRemoveSpecials`, `useRemoveDuplicates`, `useRemoveProgramming` |
| Arrange | balance, replicate, consolidate, slide | `useBalancePrograms`, `useReplicatePrograms`, `useConcolidatePrograms`, `useSlideSchedule` |
| Flex | add breaks, pad start times, restrict hours | `useAddBreaks`, `usePadStartTimes`, `useRestrictHours` |
| Manual | move, remove item, insert or edit flex, insert redirect | `store/channelEditor/actions.ts` |
| Add | add an ordered list of program ids (4a), then Phase 3 selection entries (4b) | `useAddProgramming` |

- Move the pure transforms out of the hooks into `@tunarr/shared`. The worker and the existing unit tests both use them.
- Random operations store their seed in `operation`, so the history is reproducible.
- The worker loads program summaries for the draft's program ids when a transform needs program fields.
- Operations run in-process when the worker pool is disabled (`NoopWorkerPool`).

### Program summaries

Pages carry a slim summary per program, not full `ContentProgram` objects.

- New type `LineupProgramSummary` in `@tunarr/types`:
  - `id`, `type`, `title`, `duration`, `releaseDate`
  - `episodeNumber`, `seasonNumber`
  - show, season, album and artist as `{id, title}`
- Rows render only these fields. `ProgramDetailsDialog` already fetches the full program on click.
- Measured on 5,640 unique programs, the summary is ~319 B against 3,392 B for the full object.

### Client

- `ChannelLineupList` gets its row count from the draft and fetches pages for the visible range with TanStack Query. Query keys include the draft version.
- Changed rows are highlighted after each operation, and the list scrolls to the first one.
- A history panel lists versions with their summaries. Clicking a version undoes or redoes to it.
- A header shows the difference from the saved lineup: item count, duration and show count.
- Drag and drop sends a `move` operation. The row moves optimistically and rolls back on error.
- Mid-roll grouping (`helpers/midRollGrouping.ts`) runs on the server when it builds a page, so groups never split across a page edge.
- The Zustand editor slices keep only draft id, version and UI state.
- Slot editors stay outside drafts. Chosen 09/28/2026.
  - A slot preview lives in the slot page's own state and renders through `ChannelLineupList`'s existing `type: 'direct'` mode.
  - Slot saves keep their server path (`req.type === 'time' | 'random'`). If the channel has a draft, the slot save first asks to discard it.
  - Letting tools follow a slot schedule raises whether a slot channel's lineup may drift from its schedule. That needs its own plan.

### Stages

Stages 4a to 4c ship on `dev`, because the work spans many PRs and changes the core editor.

1. **4a:** Tables, draft API, paged reads and summaries. Channel editor list reads from the draft. Every operation group runs on the server: manual, sort, remove, arrange and flex. History panel and changed-row highlights.
   - Delete the dead offsets fallback in `assembleCondensedLineup` (`LineupRepository.ts:844-848`). `startTimeOffsets` is a required array, so the branch never runs, and it has an off-by-one (`take(items, cleanOffset - 1)`).
   - All tool groups ship together, because a tool left on the client has no full list to work on once the editor pages the draft. Chosen 09/29/2026 over hiding unported tools or a temporary `replace` bridge.
   - Delete the client-side tool hooks. The tools menu is channel-only (`ChannelProgrammingTools`, `ChannelProgrammingSort` and `ChannelProgrammingDeleteOptions` are used only by `ChannelProgrammingConfig`).
   - Only the channel editor slice changes. Custom show and filler editors keep their slices until 4c. Add reaches each editor through `useProgrammingSelectionContext`, so repointing the channel editor's add leaves the others alone.
   - The `add` operation takes an ordered id list, which is Phase 3's `{kind: 'ids'}` entry shape. The client keeps its current expansion and sends the resulting ids. Chosen 09/29/2026.
2. **4b:** Add flow writes into the draft through Phase 3's resolve. The client sends `query` entries, and expansion moves to the server.
3. **4c:** Custom show and filler editors switch to drafts.
   - New custom shows and filler lists are created before programming, like channels. The "new" page saves name and settings, then routes to `$showId/programming`. Delete `custom-shows_/new/programming.tsx` and `fillers_/new/programming.tsx`. Chosen 09/28/2026.

### Open questions

None. All were settled in the 09/28–09/29/2026 grill.

## What the browser reads from the whole list today

Each dependency needs a server-side replacement in Phase 4.

| Dependency | Where | Replacement |
|---|---|---|
| Row index, `originalIndex`, drag ids | `store/channelEditor/actions.ts:54-70`, `ChannelLineupList.tsx:150-170` | Draft index plus version |
| Start offsets recomputed from item 0 | `store/selectors.ts:23-63` | Server computes offsets per page |
| Sort, shuffle, balance, replicate, remove tools | `hooks/programming_controls/*` | Draft operations |
| Mid-roll grouping | `helpers/midRollGrouping.ts:51-113` | Server groups per page |
| Calendar views | `hooks/calendarHooks.ts:62-131` | Time-window reads |
| Manual save sends the whole list | `ChannelProgrammingConfig.tsx:98-118` | Draft commit |

## Risks

- **`ChannelLineupList` is shared** with the custom show and filler editors and both slot editors. Phase 4c moves the first two to drafts. The slot editors use the in-memory `type: 'direct'` mode, so the component keeps exactly two sources: paged draft reads and a passed list.
- **Drafts outlive the tab.** A user who closes the tab and returns resumes the draft. The badge, the resume-or-discard banner and the Settings list cover this.
- **Latency per operation.** Each tool becomes a round trip plus a page fetch. Transforms on 17k items take milliseconds, so the fetch should dominate. Measure it in 4a.
- **Transform parity.** Moving transforms to `@tunarr/shared` must not change their output. Keep the existing hook tests and run them against the shared functions.
- **The resolve order must match what users expect.** Today the order is Meilisearch `sortTitle:asc`, then the descendant order. Keep that, and pass the grid's sort when there is one.
- **Zero-duration programs** must be dropped on resolve, because `ManualLineupProgramSchema` requires `duration > 0`.
- **Unexplained crash.** The first 8 GB crash never reproduced in a fresh Chrome profile. The duplication and payload explain hundreds of megabytes, not 8 GB. Retest after Phases 0 and 1.
