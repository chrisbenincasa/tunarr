# Add "Season" as a search/filter field for Smart Collections

Issue: https://github.com/chrisbenincasa/tunarr/issues/2019

## Goal & success criteria

Tunarr's Smart Collection filter builder (and the free-text search DSL) has no way
to filter by season number, so users can't exclude Specials/Extras (season 0) from
episode mixes. This change adds a numeric **Season** filter.

Success criteria:

- The Smart Collection point-and-click builder shows a new **Season** numeric field.
- `season >= 1` excludes season 0 (Specials/Extras) and is queryable in Meilisearch.
- `season >= 1` also filters **season grouping** documents by their own season number.
- The text DSL accepts `season` (e.g. `season >= 1`, `season between [1, 5]`).
- Existing smart collections are unaffected; new/updated content gets the field on scan.

## How the data flows today (context)

1. Web: `web/src/helpers/searchBuilderConstants.ts` (`SearchFieldSpecs`) defines the
   filter-field dropdown. Each spec has `key` (Meilisearch index path), optional
   `name` (DSL alias), `type`, `displayName`, `visibleForLibraryTypes`.
2. Save: `shared/src/util/searchUtil.ts` `searchFilterToString` serializes the filter
   to text (uses `name` when present).
3. Server parse: `server/src/db/SmartCollectionsDB.ts` parses that text with the shared
   `SearchParser`, then `parsedSearchToRequest` maps DSL field -> index `key` via
   `virtualFieldToIndexField`.
4. Search: `MeilisearchService.buildFilterExpression` emits `key <op> value` against
   Meilisearch, which requires the key in `ProgramsIndex.filterable` and the value
   present in documents.

The "programs" index is heterogeneous: terminal programs (movie/episode/track/...)
and program groupings (show/season/album/artist). An episode's season number lives on
its season grouping's `index` (`Season.index`, nonnegative `number`; 0 = Specials); a
season grouping's own number is its top-level `index`.

## Key design decision: a dedicated `seasonIndex` field

There is no single existing index field that means "season number" on both episode and
season-grouping documents:

- Episode docs: top-level `index` = **episode number**; their `parent` is the season.
- Season-grouping docs: top-level `index` = **season number**; their `parent` is the show.

So reusing `index` (it would match episodes by episode number, i.e. all episodes) or
`parent.index` (absent on season groupings) cannot serve both. Instead we add a
dedicated `seasonIndex` field populated uniformly with "season number":

- Episode docs: `seasonIndex = program.season?.index`
- Season-grouping docs: `seasonIndex = season.index`

A single `season` filter then covers both, with no episode-number collision and no
`type` pairing required.

## Changes

### 1. Server index - `server/src/services/MeilisearchService.ts`

- Add `seasonIndex?: number;` to `BaseProgramSearchDocument` (~line 262-286). Both
  `TerminalProgramSearchDocument` and `ProgramGroupingSearchDocument` extend it, so
  the field is available on episode and season-grouping docs (undefined elsewhere).
- Add `'seasonIndex'` to the `ProgramsIndex.filterable` array (~line 124-172).
- Populate the field:
  - `convertProgramToSearchDocument` return literal (~line 1761-1815): add
    `seasonIndex: program.type === 'episode' ? program.season?.index : undefined,`.
    This is the single choke point for terminal docs, so both `indexEpisodes` and
    `indexTerminalPrograms` pick it up automatically (no parent-builder edits needed).
  - `indexSeason` document literal (~line 866-913): add `seasonIndex: season.index,`.
  - `convertPartialProgramToSearchDocument` return literal (~line 1893-1940): add the
    same episode `seasonIndex` expression for completeness/future partial updates.

Notes:
- Keep the existing top-level `index` fields untouched (episode number / season number
  / track number / album index). `seasonIndex` is additive.
- `index` is **not** added to `filterable`, avoiding the "`index` means different
  things per type" footgun.

### 2. Shared DSL - `shared/src/util/searchUtil.ts`

- Add `'season'` to the `NumericFields` token list (~line 91-101).
- Add `season: 'seasonIndex',` to `virtualFieldToIndexField` (~line 384-415).

`season` becomes usable in the text DSL and round-trips through
`searchFilterToString`/`parsedSearchToRequest`. No token conflicts.

### 3. Web filter builder - `web/src/helpers/searchBuilderConstants.ts`

Add a numeric spec (place after the "Show Title" spec, ~line 90):

```ts
{
  key: 'seasonIndex',
  name: 'season',
  type: 'numeric' as const,
  displayName: 'Season',
  uiVisible: true,
  visibleForLibraryTypes: ['shows'],
} satisfies SearchFieldSpec<'numeric'>,
```

Notes:
- `visibleForLibraryTypes: ['shows']` records intent, but the current UI does not wire
  `mediaTypeFilter` into `SearchValueNode`, so the field displays for all library
  types today (same as the existing "Show Title" field). Acceptable; smart collections
  span libraries anyway.
- No generated-client/OpenAPI changes: the `SearchField` schema already supports
  numeric fields with arbitrary `key`/`name`, and `/programs/search` returns converted
  API programs (season `index` read from the DB, not the raw search doc), so the
  internal `seasonIndex` field does not surface in the OpenAPI response.

### 4. Documentation - `docs/misc/search/index.md`

- Add a `season` row to the "Fields" table:
  `| season | number | Season number (episodes: their season's number; season groupings: their own number; 0 for Specials) | 1 |`.
- Add a short note that the field applies to content indexed after this change, and
  that existing TV libraries should be re-scanned (force rescan) to populate it for
  previously indexed episodes and season groupings (per the "no automatic backfill"
  decision).

### 5. Tests

- `shared/src/util/searchUtil.test.ts`:
  - Parse `season >= 1` -> `single_numeric_query` with `field: 'season'`.
  - `parsedSearchToRequest` maps it to `fieldSpec`
    `{ key: 'seasonIndex', name: 'season', type: 'numeric', op: '>=', value: 1 }`.
  - `searchFilterToString` round-trips back to `season >= 1`.
- `server/src/services/MeilisearchService.test.ts`:
  - `buildFilterExpression` for a numeric value node
    `{ key: 'seasonIndex', type: 'numeric', op: '>=', value: 1 }` yields
    `seasonIndex >= 1`.

### 6. Build & verify

- Rebuild the shared package first: `pnpm --filter @tunarr/shared build` (server and
  web consume the compiled `dist`; the server even imports
  `shared/dist/src/util/searchUtil.js` directly).
- Run `pnpm --filter @tunarr/shared test`, the server test file, `pnpm turbo typecheck`,
  and `pnpm lint-changed`.
- Manual verification: start dev servers, open a Smart Collection's point-and-click
  builder, add a "Season" field (`>= 1`), confirm the serialized expression is
  `season >= 1`, and confirm results exclude season-0 episodes. Also verify the text
  DSL `season >= 1` parses.

## Edge cases & failure modes

- **Season 0 (Specials/Extras):** handled by normal numeric ops (`season = 0`,
  `season != 0`, `season >= 1`). No special casing needed.
- **Unrestricted `type`:** `season >= 1` matches both episodes (season >= 1) and
  season groupings (own index >= 1) — coherent "season number" semantics; movies and
  tracks have no `seasonIndex` and never match.
- **Episodes without a season grouping:** `seasonIndex` is `undefined`, so they won't
  match a `season` filter (correct — no season number to filter on).
- **Existing documents lacking `seasonIndex`:** per decision, no automatic backfill.
  Until a (force) rescan, previously indexed episodes/season groupings won't match
  season filters. Documented in step 4.
- **Invalid/float input:** the numeric editor parses integers; Meilisearch returns no
  matches for values that never equal a nonnegative season index — no crash path.
- **Filter serialization:** `name: 'season'` ensures the stored string uses `season`
  (not `seasonIndex`), keeping smart-collection filters readable and stable across
  index-path changes.

## Assumptions

- No database or API schema change; therefore no migration and no OpenAPI/web-client
  regeneration (verified above).
- No sorting/facet changes requested; only filterability is in scope
  (`seasonIndex` is not added to `sortable`).
- `season` is the DSL/UI field name.

## Out of scope

- Automatic backfill / search-index schema versioning (explicitly declined).
- Season/episode as sortable fields.
- Wiring `mediaTypeFilter` into the filter builder to restrict the field by library
  type.
