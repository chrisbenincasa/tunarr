# Replace material-react-table with TanStack Table and an in-house MUI wrapper

## Why

- `material-react-table` (MRT) 3.2.1 is the last release. It was published 03/01/2025 and nothing newer is in progress on npm.
- MRT blocks the MUI 7 to 9 upgrade. Its bundle still passes props that MUI 9 removed (`SelectProps` ×15, `InputProps` ×7, `inputProps` ×7, `MenuListProps` ×5, `componentsProps` ×1). MUI 9 drops those props without warning.
- MRT's peer range (`@mui/material >=6`) hides the problem. pnpm will not warn.
- MRT is a MUI skin over TanStack Table, a headless library that owns table state and leaves rendering to the caller. If we render with MUI's `<Table>` components ourselves, no table code carries a MUI peer dependency.

## Status

- **Phase 0 in review (10/19/2026).** PR #2350, branch `feat/datatable`, based on `main`. Review fixes applied 10/19/2026.
  - The v9 spike hit none of the fallback triggers. No casts, no internals, no `useLegacyTable`.
  - The parity spec passes on MRT for 8 pages, and on the wrapper for `/library/fillers`. Settings saved by the MRT build load unchanged.
  - The ban is in `web/.oxlintrc.json`, with 15 legacy files.
- Phase 0 runs alongside `plans/web-redesign.md` Phases 1 and 2, and must land before that plan's Phase 3 (decided 10/19/2026).
- Next: Phase 1.

### Phase 0 notes

- `actionsColumn({ render })` takes no `position`. Callers place the column first or last, and `DataTable` aligns it to that edge, so placement and alignment cannot disagree.
- Column meta is typed through v9's scoped `columnMeta: metaHelper<TunarrColumnMeta>()` slot, not a global `ColumnMeta` augmentation.
- The new `useStoreBackedTableSettings` lives in `components/ui/table/` and wraps the unchanged `useTableSettings`. The MRT version in `hooks/useTableSettings.ts` stays until Phase 4.
- The text filter uses `includesString`. MRT used fuzzy matching, so a typo no longer matches.
- `DataTable` keeps MRT's accessible names ("Show/Hide filters", "Show/Hide search", "Search", "Toggle visibility X", "Sort by X ascending", "Sorted by X descending", "Rows per page"), so one spec runs on both. Two names extend MRT's and still match the spec's substring lookups. The filter toggle reads "Show/Hide filters (N active)" while filters are set, and the range inputs read "Min X" and "Max X".
- The header keeps two sort targets, the header text and the sort label. Wrapping the text in `TableSortLabel` would make the column header's accessible name start with "Sort by", and the spec finds headers by their column name.
- The global search stays behind its toggle, as MRT's does by default. Clear filters appears only for column filters and clears only those.
- `hooks/useTableSettings.ts` and `store/settings/actions.ts` type MRT's persisted state with v9's `PaginationState`, `SortingState` and `ColumnVisibilityState`. They match v8's shapes today, but nothing enforces it. Check them when bumping v9 before Phase 4 removes MRT.
- The parity spec skips `MediaSourceLibraryTable`, the subtitle table and both slot tables, each with a reason. Their port PRs add the entry and make it pass on MRT first.
- Pages with `ported: true` in the spec also check the filter count and Clear filters.
- The legacy list includes 3 files that use plain MUI `Table` without MRT: `StatusPage`, `TroubleshootPage`, `ConnectMediaSources`. They need a static-table primitive or a `DataTable` port before they leave the list.
- Each legacy override turns off the whole `no-restricted-imports` rule. When another ban joins that rule (`Chip`, say), legacy table files escape it too. Split the overrides then.
- `@tanstack/react-table` 9.3.1 was published 10/12/2026.
- This supersedes the advice in `plans/dependency-audit-2026-09-16.md` to keep TanStack Table on v8 while MRT is in use, because MRT goes away.

## Decisions

All decided 10/18/2026.

| Decision                | Choice                                                                     | Reason                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Table engine            | `@tanstack/react-table` v9 (9.3.1)                                         | Stable since 08/04/2026. All the code is new, so starting on v8 would mean migrating it twice. Phase 0 can fall back to v8 (see Phase 0). |
| v9 setup                | Explicit `features` per table and no `stockFeatures`                       | v9 tree-shakes by feature. `stockFeatures` and `useLegacyTable` are migration aids that bundle everything.                                |
| App conventions         | `createTableHook`                                                          | v9's hook for shared defaults (features, row models, shared cell and header components). This becomes our wrapper's core.                 |
| Rendering               | MUI `Table`, `TableHead`, `TableSortLabel`, `TableBody`, `TablePagination` | Public MUI API only. See MUI 9 readiness.                                                                                                 |
| Row drag-reorder        | `react-dnd`, which is already a dependency (`^16.0.1`)                     | Two tables need it, and a second DnD library isn't worth it.                                                                              |
| Reorder semantics       | `move`, not `swap`                                                         | Today's `swap` is almost certainly unintended. See Phase 3.                                                                               |
| Reorder without a mouse | "Move up" and "Move down" row actions                                      | HTML5 drag does not fire for touch or keyboard input.                                                                                     |
| Coexistence             | MRT and the wrapper run side by side until Phase 4                         | MRT bundles its own `@tanstack/react-table` 8.20.6, so a direct v9 dependency doesn't conflict.                                           |
| Persisted settings      | Keep the store shape and column ids                                        | v9's state shapes match the stored ones. See Persisted settings.                                                                          |
| Strings                 | Lingui `t`                                                                 | 12 of the 13 MRT files already use Lingui. MRT's built-in strings were English-only.                                                      |
| Small screens           | Out of scope                                                               | The wrapper scrolls sideways like MRT. See Follow-ups.                                                                                    |
| Release                 | Each phase merges to `main` and ships as it lands                          | Small PRs and bisectable regressions. The mixed old and new toolbars are cosmetic.                                                        |

## Current MRT usage

There are 13 files, about 4,100 lines. Every table also has MRT's default toolbar: a global search box, a show-filters toggle, a density toggle, a fullscreen toggle, column action menus, a column-visibility menu, and pagination.

| File                                                            | Lines | Features beyond the basics                                                                         |
| --------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------- |
| `components/settings/ffmpeg/TranscodeConfigsTable.tsx`          | 195   | Row actions, toolbar actions                                                                       |
| `components/smart_collections/SmartCollectionsTable.tsx`        | 163   | Row actions, toolbar actions, empty fallback                                                       |
| `pages/library/FillerListsPage.tsx`                             | 249   | Row click, `range` filter, empty fallback, row actions                                             |
| `pages/library/CustomShowsPage.tsx`                             | 238   | Row click, `range` filter                                                                          |
| `pages/settings/MediaSourceSettingsPage.tsx`                    | 278   | Row actions, per-cell styling                                                                      |
| `pages/settings/TaskSettingsPage.tsx`                           | 283   | Row actions, per-cell styling, no persisted settings, phone layout                                 |
| `pages/system/SystemLogsPage.tsx`                               | 191   | `multi-select` filter, page size 50, no persisted settings                                         |
| `pages/channels/ChannelsPage.tsx`                               | 619   | Row click, two `checkbox` filters, phone layout with its own `TablePagination`                     |
| `components/MediaSourceLibraryTable.tsx`                        | 596   | Row click, per-cell styling, column filters turned off per column, phone layout                    |
| `components/channel_config/ChannelSubtitlePreferencesTable.tsx` | 211   | Drag reorder, inline `select` cell edit, toolbar actions                                           |
| `components/slot_scheduler/TimeSlotTable.tsx`                   | 562   | Custom program cells, `getRowId`, page size 25, `MRT_TableInstance` passed to helpers              |
| `components/slot_scheduler/RandomSlotTable.tsx`                 | 614   | Drag reorder **or** sorting depending on `distributionType`, `MRT_TableInstance` passed to helpers |
| `hooks/useTableSettings.ts`                                     | 128   | Persists table state. `useStoreBackedTableSettings` returns `MRT_TableOptions`.                    |

No table uses server-side pagination, sorting or filtering, row virtualization, row selection, grouping, or column resizing.

## Wrapper design

Everything lives in `web/src/components/ui/table/`, inside the component layer from `plans/web-redesign.md`. The table takes its look from that plan's dense collection mock and its sizes from the app-wide density setting. Every state has a Storybook story.

- `tunarrTable.ts` calls `createTableHook` and defines the `features` set (sorting, column filtering, global filtering, pagination, column visibility) along with the row-model slots.
- `DataTable.tsx` renders a table instance. It supports:
  - a toolbar (see Toolbar controls) with a `toolbarActions` slot
  - a header with `TableSortLabel` and the filter row
  - a body with `getRowProps` (row click, row styling) and per-cell props taken from column `meta`
  - an `emptyFallback` slot
  - `TablePagination`
- `columns.tsx` holds display-column helpers:
  - `actionsColumn({ render })` replaces `enableRowActions`, `renderRowActions`, `positionActionsColumn` and `displayColumnDefOptions`. Its place in the column list sets its position.
  - `dragHandleColumn()` for reorderable tables
- `filters/` holds the four filter variants in use, which are text, `range`, `checkbox` and `multi-select`. We build nothing else.
- `useRowReorder.ts` implements `react-dnd` drag and drop over rows and calls `onReorder(from, to)`.
- `useTableSettings.ts` stays at its current path. A new `useStoreBackedTableSettings` in `components/ui/table/` returns v9 state slices and updaters in place of `MRT_TableOptions`.

Column `meta` carries the per-column extras MRT had as top-level keys (`muiTableBodyCellProps`, `grow`, `size`). The wrapper types them through v9's `columnMeta` feature slot.

Inline editing stays out of the wrapper. The subtitle table renders its own `Select` in the cell, because no other table edits in place.

### Toolbar controls

| Control                | Decision                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| Global search          | Keep, on the tables that have it today                                      |
| Show/hide filters      | Keep                                                                        |
| Column-visibility menu | Keep, persisted as today                                                    |
| Density toggle         | Drop. Tables follow the app-wide density setting (`plans/web-redesign.md`). |
| Fullscreen toggle      | Drop                                                                        |
| Per-column action menu | Drop. Header click sorts, and the visibility menu hides columns.            |

### Filters

- Filter fields sit under the header row, hidden by default behind a toolbar toggle, as today.
- Filters and the global search are not persisted, as today. The settings store does not change.
- When any filter is active, the toggle shows a count and the toolbar shows a "Clear filters" action. This holds whether the filter row is open or closed.

## Persisted settings

- Table settings persist in `localStorage` under the `tunarr` key (`web/src/store/index.ts`). They are validated on load by `TableSettingsSchema` in `web/src/store/settings/store.ts`.
- v9's state shapes match what we store. `PaginationState` is `{ pageIndex, pageSize }`, `SortingState` is `Array<{ id, desc }>`, and `ColumnVisibilityState` is `Record<string, boolean>`. Only the visibility type's name changed, from v8's `VisibilityState`.
- No schema version bump or migration is needed.
- Keep every column `id` and `accessorKey`. A changed id silently resets a user's saved visibility or sort.
- Do not offer a page size of `Infinity`, which v9 allows to mean "all rows". JSON stores it as `null`, which fails `z.int()` and discards the user's saved settings.
- Saved entries can contain MRT display-column ids such as `mrt-row-actions`. The wrapper ignores unknown ids, so they are harmless.

## MUI 9 readiness

- The wrapper uses only APIs that MUI 9 keeps. That means `slotProps` in place of `InputProps`, `inputProps`, `SelectProps` and similar, and `sx` in place of system props like `<Box mt={2}>`.
- Each port converts removed MUI props in the lines it rewrites. Untouched lines wait for the MUI 9 codemods.
- No repo-wide lint rule for removed props. That belongs to the MUI 9 plan.

## Small screens

- The wrapper renders a table that scrolls sideways on narrow screens, matching MRT.
- `ChannelsPage`, `TaskSettingsPage` and `MediaSourceLibraryTable` keep their hand-built phone layouts below the `sm` breakpoint. Only their desktop branch moves to the wrapper.
- `plans/web-redesign.md` Phase 3 later replaces those phone layouts. Below `sm`, its `CollectionView` always renders cards.

## Phases

Each phase is one PR against `main`, merged and released as it lands. Each PR leaves the app working. Users see a mix of old and new toolbars for a few releases, which is cosmetic. Land Phases 1 and 2 in one release cycle to keep that window short.

### Phase 0. Wrapper, parity spec, and v9 spike

- Add `e2e/tests/tables.spec.ts` (see Testing) and make it pass on MRT before changing any table.
- Move `@tanstack/react-table` from devDependencies to dependencies at `^9.3.1`.
- Check that MRT still resolves its nested 8.20.6 and that `store/settings/actions.ts`, which imports `PaginationState` and `SortingState`, still typechecks.
- Build `tunarrTable.ts`, `DataTable.tsx`, `actionsColumn`, the `range` filter, and the new `useStoreBackedTableSettings`.
- Port `FillerListsPage.tsx`. It exercises row click, a filter, the empty fallback, row actions and persisted settings, which is nearly every wrapper piece except reorder.
- Exit when the parity spec and the route sweep pass on `/library/fillers`, and settings saved by an MRT build load unchanged.

**Fallback to v8.** Stay on v9 unless the spike hits one of these:

- a v9 bug that needs a workaround reaching into its internals
- a type error we can only silence with a cast
- state that won't stay in sync with persisted settings without `useLegacyTable`

Any of these means redoing the spike on v8.21.3, which costs one table. Unfamiliar APIs and thin docs do not count.

### Phase 1. Simple tables

- `TranscodeConfigsTable`, `SmartCollectionsTable`, `TaskSettingsPage`, `MediaSourceSettingsPage`
- `CustomShowsPage`, which reuses the `range` filter
- `SystemLogsPage`, which adds the `multi-select` filter

### Phase 2. Large list tables

- `ChannelsPage` adds the `checkbox` filter.
- `MediaSourceLibraryTable`

### Phase 3. Reorder and editing

- Build `useRowReorder` and `dragHandleColumn`.
- Dropping a row moves it, so the rows in between shift. Both tables call `fieldArray.move(from, to)`. Today both call `swap`, which only trades the dragged row with the drop target (`ChannelSubtitlePreferencesTable.tsx:199-205`, `RandomSlotTable.tsx:552-558`). This is a deliberate behavior change. Note it in the PR description and the release notes.
- Each reorderable row also gets "Move up" and "Move down" in its actions, calling the same `move(from, to)`. HTML5 drag, which both MRT and our react-dnd `HTML5Backend` use, does not fire for touch or keyboard input, so today these tables cannot be reordered on a phone or without a mouse.
- Port `ChannelSubtitlePreferencesTable`.
- Port `TimeSlotTable` and `RandomSlotTable`. Their helper signatures take `MRT_TableInstance`, which becomes the wrapper's table type. `RandomSlotTable` switches between reorder and sorting on `distributionType`.

### Phase 4. Removal

- Remove `material-react-table` from `web/package.json`.
- Add a lint rule (`no-restricted-imports`) that blocks `material-react-table`.
- Re-run the e2e sweep. If the "Cannot update a component while rendering a different component" entry in `e2e/tests/knownIssues.ts` no longer fires, delete it. Its routes match the MRT pages, but MRT is not proven to be the cause.
- Update `.claude/.codebase-info/` and `CLAUDE.md` where they mention MRT.

## Testing

- **Table parity spec.** Phase 0 adds `e2e/tests/tables.spec.ts` and makes it pass on MRT before any port. It is parameterized over every table page. For each page, it checks:

  - sorting a column
  - hiding a column, reloading, and confirming it stays hidden
  - changing the page size, reloading, and confirming it persists
  - applying a filter
  - running one row action

  Every port PR keeps it green. Steps that assert new behavior (the filter count and clear button, Move up and Move down) are added in the PR that builds them. The slot tables may need a schedule seeded in `e2e/fixture/seed.ts`.

- **Existing e2e.** The route sweep (`cd e2e && pnpm e2e`) fails on any `console.error`. `e2e/tests/channelSubtitlePreferences.spec.ts` checks that subtitle edits mark the form dirty.
- **Unit tests.** Vitest and Testing Library cover `DataTable`, the filter variants, and `useRowReorder`.
- **Screenshots.** Each port PR includes before and after screenshots of its pages, to catch layout drift the spec cannot see.
- **Manual testing.** The maintainer tests each PR by hand before merge.

## Risks

| Risk                                                                          | Mitigation                                                                                                                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v9 is 2.5 months old                                                          | Small explicit feature set, no internals, a `^9.3.1` range like the other TanStack packages with the lockfile pinning the exact version, and the Phase 0 fallback rule. |
| A changed column id resets saved settings without any error                   | Keep ids. The parity spec's reload steps catch it.                                                                                                                      |
| Users miss dropped toolbar controls                                           | Density is the most likely request, and it is a small addition.                                                                                                         |
| Changing reorder from `swap` to `move` surprises someone                      | Release notes. `move` matches what the drop indicator shows.                                                                                                            |
| Desktop layout shifts from MRT's CSS-grid `layoutMode` to native table layout | Before and after screenshots in each port PR.                                                                                                                           |

## Follow-ups

- **Mobile support.** Tunarr's mobile support is thin overall. Scope it in its own plan after Phase 4. Candidates include a wrapper-owned card mode below `sm` (one `renderMobileCard` prop would cover all 13 tables) and touch-friendly drag reorder.
- **MUI 9 upgrade.** This gets its own plan and starts after Phase 4.
