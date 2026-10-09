# Emby search fields (#2146) and ETag-gated Jellyfin/Emby scans

> **Status (10/08/2026):** Design settled in a grilling session; not started. Merge order is Phase A PR → #1801 → stacked Emby PR. Next step: implement the Phase A PR on `main`.

## Merge order

| Order | PR | Base | Contents |
|-------|----|------|----------|
| 1 | Phase A | `main` | ETag-first compare at nine scanner sites, rescan-request table, paging off-by-one, scan metrics |
| 2 | #1801 (`extra-search-fields`) | `main` | Existing search fields work, rebased onto Phase A. Its migration (now `0053`) adds rescan-request rows for Plex and Jellyfin libraries |
| 3 | Emby search fields (#2146) | `extra-search-fields` | Emby mappings plus its own migration with an Emby-only rescan-request insert. Retarget to `main` after #1801 merges |

## 1. Phase A PR

### 1.1 ETag-first compare

- Hook on the base `MediaSourceScanner`, for example `protected listItemCanonicalIdIsAuthoritative(): boolean`. Jellyfin and Emby return `true`. Plex returns `false` and keeps today's order at every site.
- Plex is out of scope because its canonical ID is a custom hash that may differ between list and full responses (`PlexMediaCanonicalizers.ts:80`).
- When the hook returns `true` and `force` is off, compare the list item's `canonicalId` to the DB before the full fetch, and skip the fetch on a match.
- The list ETag can stand in for the full one. Both canonicalizers return the raw `Etag` (`services/JellyfinItemCanonicalizer.ts`, `services/EmbyItemCanonicalizer.ts`), and both calls send the media source's `userId`.
- A `NULL` stored `canonicalId` counts as changed at all nine sites. Shows (`MediaSourceTvShowLibraryScanner.ts:265-268`) and artists (`MediaSourceMusicArtistScanner.ts:289`) currently treat it as unchanged.

| Site | File | Full fetch → compare |
|------|------|----------------------|
| Movie | `MediaSourceMovieLibraryScanner.ts` | `:196` → `:209` (already compares the list ID) |
| Show | `MediaSourceTvShowLibraryScanner.ts` | `:255` → `:268` |
| Season | `MediaSourceTvShowLibraryScanner.ts` | `:443` → `:456` |
| Episode | `MediaSourceTvShowLibraryScanner.ts` | `:541` → `:559` |
| Music video | `MediaSourceMusicVideoScanner.ts` | `:172` → `:189` |
| Other video | `MediaSourceOtherVideoScanner.ts` | `:171` → `:188` |
| Artist | `MediaSourceMusicArtistScanner.ts` | `:127`/`scanArtist` → `:289` |
| Album | `MediaSourceMusicArtistScanner.ts` | `updateAlbum` → `:459` |
| Track | `MediaSourceMusicArtistScanner.ts` | `scanTracks` → `:566` |

- Unchanged shows, seasons, artists, and albums still descend into their children. A parent ETag does not cover its children.

### 1.2 Rescan-request table

Backfills new fetched fields without rewriting program data.

- New table `media_source_library_rescan_request`, with `library_id` (FK to `media_source_library.uuid`, `ON DELETE CASCADE`), `reason` text, and `requested_at`.
- `MediaSourceScanCoordinator.add` (`:119`) sets `forceScan = true` when the library has a pending row.
- The row is deleted only after a complete scan. That means no `pathFilter`, `controller.signal.aborted` is false, and nothing threw. A canceled scan returns early without throwing (`MediaSourceMovieLibraryScanner.ts:136-138`), so the coordinator checks the abort signal.
- Feature migrations add rows with `INSERT ... SELECT` and never update program or grouping rows.
- The table rejected two alternatives:
  - Nulling `canonical_id` breaks `ProgramConverter.ts:72` (called from `programmingApi.ts:766`) and `programmingApi.ts:272`, and it hides rows from the existing-item lookups (`ProgramSearchRepository.ts:73`, `:138`, `:186`). That delays missing-detection by one scan.
  - A sentinel value rewrites program data.

### 1.3 Paging off-by-one (separate commit)

- `JellyfinApiClient.ts:916` and `EmbyApiClient.ts:1072` loop `page <= totalPages`, so they fetch one empty page per listing. Change both to `<`.
- The end of the list is known without the empty page. Jellyfin counts up front (`:877-881`), and Emby reads `TotalRecordCount` from page 0.

### 1.4 Scan metrics

- At scan end, log the library, elapsed time, list-page request count, and per-item request count, using a per-scan counter on the API client.
- An unchanged library should show zero per-item requests after Phase A.

### 1.5 Tests

- Mock-based, following the pattern in `MediaSourceOtherVideoScanner.test.ts`. One file per base class: movie, TV, music video, other video, music artist.
- Four-case matrix at each level:

| Case | Expected full fetches |
|------|-----------------------|
| Hook `true`, list ETag matches DB | 0 |
| Hook `true`, ETag differs | 1 |
| Hook `true`, `force` on | 1 |
| Hook `false` (Plex), ETag matches | 1 |

- Also assert that unchanged parents still descend into children, that skipped items are not marked missing, and that a `NULL` stored ID counts as changed.
- Coordinator tests cover four cases: a pending row forces the scan, a complete scan clears the row, and a canceled scan or a `pathFilter` scan keeps it.
- Paging tests assert exact page counts, including an empty library.

## 2. #1801 changes

- Rebase onto Phase A.
- Add to its migration (`0053`) an `INSERT` of rescan-request rows for Plex and Jellyfin libraries.

## 3. Emby search fields (#2146), stacked on #1801

- `summary` needs no work. Emby already maps `Overview` to `plot` (`EmbyApiClient.ts:1227`, `:1422`).
- The source fields already exist in the schema (`types/src/emby/index.ts:406`, `:410`, `:419`).

| Step | File | Change |
|------|------|--------|
| 1 | `EmbyApiClient.ts:110` | Add `ProductionLocations`, `CommunityRating`, `CriticRating` to `RequiredLibraryFields` |
| 2 | `EmbyApiClient.ts` `getMovieLibraryContents` (`:580`), `getTvShowLibraryContents` (`:618`) | Add the same three to the inline field lists |
| 3 | `embyApiMovieInjection` (`:1207` block) | `countries`, `collections: []`, `audienceRating`, `criticRating`, copied from #1801's Jellyfin diff |
| 4 | `embyApiShowInjection` (`:1401` block) | Same four fields |
| 5 | Migration | `INSERT` rescan-request rows for Emby libraries |
| 6 | Test | Emby movie fixture with the three fields, asserting the injection output |

- Open question: confirm on a live Emby server that `CommunityRating` and `CriticRating` are accepted as `Fields` values. Emby may return them by default, as Jellyfin does.

## 4. Phase B (deferred)

- Phase B would slim the list call to light fields and fetch heavy fields only for changed items.
- Go ahead only if, after Phase A, list pages take more than 50% of an unchanged scan that runs longer than about one minute, measured with the 1.4 metrics on a large Jellyfin library.
- If it goes ahead, use a stub list type (`externalId`, `canonicalId`, type). Don't make the injections tolerate missing fields. Without `MediaSources`, `jellyfinApiMovieInjection` returns `null` (`JellyfinApiClient.ts:1145-1147`), `getChildContents` drops it without a sound, and the scanner would mark the item missing.

## Accepted risks

- Jellyfin/Emby may not change an item's `Etag` when only `MediaStreams` change, for example after a re-probe or a new external subtitle. Today's code already skips the write in that case, so Phase A adds no new gap. A forced scan or a rescan-request row recovers it.
- The first scan after each migration is a full forced scan. That means subtitle re-downloads and a Meilisearch reindex.
