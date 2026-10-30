# Search field restriction (complete PR #1545)

> **Status (10/18/2026):** Designed and grilled. PR #1545 closed; its `search-restrict` branch is kept for reference. Next step is implementing PR 1 on `main`.

## Goal

Users pick which fields keyword search matches (title, show title, summary, people, and so on). The choice must be correct, persistent, and validated end to end.

## Where things stand

### Already on `main`

- `SearchRequestSchema.restrictSearchTo` (`types/src/schemas/SearchRequest.ts:172`) carries a field list.
- `SearchProgramsCommand` casts it to `Path<ProgramSearchDocument>[]` and passes it on (`server/src/commands/SearchProgramsCommand.ts:53`).
- `MeilisearchService.search` sends it as `attributesToSearchOn` (`server/src/services/MeilisearchService.ts:1512`).
- `SearchFieldRestrictMenu` renders checkboxes behind the filter icon in `SearchInput`.
- Slot scheduler, cyclic shuffle dialog, and troubleshoot page already pass `['title']`.

### Defects on `main`

| # | Defect | Effect |
|---|--------|--------|
| 1 | "Title" and "Show Title" both use key `title` | One checkbox toggles both. React duplicate-key warning when the menu opens. |
| 2 | `syncIndexSettings` never sets `searchableAttributes` | Meilisearch defaults to `*`. Keywords match IDs, external IDs, `titleReverse`, codecs. Ranking follows document field order. |
| 3 | "All checked" and "none checked" both send `undefined` | Both mean "search every field", including fields the menu never lists. |
| 4 | `selectedDefault` is ignored | Initial state is all keys, so Summary is on despite `selectedDefault: false`. |
| 5 | Restriction lives in `SearchInput` local state | Lost on reload and navigation. Not in the URL. The `__root.tsx` loader overwrites `currentSearchRequest` and drops it. |
| 6 | Smart collections save `filter` and `keywords` only | A saved collection searches all fields even if the user restricted them. |
| 7 | Server accepts any string array, unchecked cast | No validation. Unknown names pass straight to Meilisearch. |
| 8 | `ProgramSearchRequest.restrictSeachTo` (typo) | Dead field in the API schema and generated client. |
| 9 | `mediaType` prop is commented out at the call site | Menu shows every option in every library. |

### What PR #1545 does

- Removes the `restrictSeachTo` typo field (fixes #8).
- Turns each option's `key` into `keys[]` and adds Tagline.
- Uses `show.title` for Show Title. **No such document field exists.** Episodes carry the show in `grandparent.title`.
- Comments out library-type filtering instead of fixing it.
- Merges `currentSearchRequest` in `__root.tsx` so the loader stops dropping fields (partial fix for #5).
- Leaves #2, #3, #4, #6, #7 untouched.

Salvage the typo removal and the root-loader merge. Redo the rest.

## Decisions (grilled 10/18/2026)

| Topic | Decision |
|-------|----------|
| Branch | Close #1545, restart on `main`. Carry over the `restrictSeachTo` removal and the `__root.tsx` merge. |
| Field identity | Store filter-language field names, resolved through `virtualFieldToIndexField`. Same scheme as smart collection filters. |
| Searchable set and rank | Menu fields first, then `genres.name`, `studio.name`, `tags` last. IDs, external IDs, `titleReverse`, and stream fields stop matching keywords. |
| Empty selection | Blocked. "Reset" replaces "Clear". Server rejects `[]`. |
| Defaults | Everything except Summary. |
| Smart collections | Persist the selection now, in a stacked PR released with the main one. |

## Plan

### 1. Field names (`types`, `shared`)

- Add `season_title: 'parent.title'` to `virtualFieldToIndexField` (`shared/src/util/searchUtil.ts`). It also becomes a filter field.
- Define `KeywordSearchFields` in `types/src/schemas/SearchRequest.ts` as the allowed names: `title`, `show_title`, `season_title`, `actor`, `director`, `writer`, `tagline`, `summary`, `plot`.
- Change `restrictSearchTo` to `z.enum(KeywordSearchFields).array().min(1).optional()`.
- Remove `ProgramSearchRequest.restrictSeachTo`.

Menu groups (UI only; the stored list holds plain names):

| Label | Field names | Index paths | Default |
|-------|-------------|-------------|---------|
| Title | `title` | `title` | on |
| Show / Artist | `show_title` | `grandparent.title` | on |
| Season / Album | `season_title` | `parent.title` | on |
| Cast & Crew | `actor`, `director`, `writer` | `actors.name`, `director.name`, `writer.name` | on |
| Tagline | `tagline` | `tagline` | on |
| Summary | `summary`, `plot` | `summary`, `plot` | off |

Summary needs both paths because sources disagree. Plex movies and episodes fill `summary`, while Plex shows, seasons, and albums fill `plot`.

### 2. Server

- Set `searchableAttributes` on `ProgramsIndex` in this order: `title`, `grandparent.title`, `parent.title`, `actors.name`, `director.name`, `writer.name`, `tagline`, `summary`, `plot`, `genres.name`, `studio.name`, `tags`.
- `syncIndexSettings` sends it. Meilisearch re-indexes once after upgrade, in the background.
- `SearchProgramsCommand` maps field names to index paths through `virtualFieldToIndexField`. Delete the cast.
- No field list means the whole searchable list, including genres, studio, and tags.
- Unit test the name mapping, the `.min(1)` rejection, and the settings payload.

### 3. Web menu and state

- Build the menu from the group table. One checkbox per group.
- Initial state and "Reset" both use the defaults. A default search sends an explicit list.
- Disable the last checked box so the selection never empties.
- Send no list only when every group is checked.
- Move the selection into the zustand store next to `currentSearchRequest`.
- Add a `fields` URL param to `searchQuerySchema` in `__root.tsx`. The loader merges instead of replacing.
- Restore library-type filtering. Hide Show / Artist and Season / Album in movie and other-video libraries.

### 4. Smart collections (stacked PR)

- Add a nullable `search_fields` text column (JSON array of field names) to `smart_collection`, with a migration.
- `null` means the full searchable list, so existing collections return the same items as today.
- `CreateSmartCollectionDialog` saves the current selection. `SmartCollectionsDB` passes it to `search`.
- `routes/library/smart_collections/$id.tsx` loads it into the menu, so the page grid matches the collection's contents.

### 5. Docs and tests

- Document keyword field selection, the defaults, and the low-ranked genre, studio, and tag matches in `docs/configure/library/smart-collections.md`.
- Document `season_title` as a new filter field.
- Regenerate OpenAPI and the web client.
- Add an e2e step that opens the restrict menu, so React key warnings fail the route sweep.

## Delivery

| PR | Steps | Size | Migration |
|----|-------|------|-----------|
| 1 | 1, 2, 3, 5 | ~300–400 lines | No |
| 2 (stacked on 1) | 4, plus its docs | ~150 lines | Yes |

Both PRs go to `main` and ship in the same release. Otherwise the smart collection page would show default fields while the collection searches all of them.
