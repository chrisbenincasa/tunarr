# Web Redesign on a Tunarr Component Layer

> **Status (10/19/2026):** Phase 0 is done, in PR #2348 (`feat/design-tokens-theme`) and PR #2349 (the story diff script, stacked on it). Phase 2 (`AppShell`) is built on `feat/app-shell`, stacked on PR #2348, and not yet committed. `plans/mrt-replacement.md` Phase 0 runs in parallel. Phase 1 mocks for forms, the media browser and slot editors stay one phase ahead.

## Why

- MUI's default look makes Tunarr feel dated. The old theme set only palette colors.
- The mocks change page layouts, not just colors. A theme alone cannot reach them (screenshots, 10/18/2026).
- So every page gets rebuilt. That is about 35 distinct screens behind 53 routes.
- The maintainer is not a designer. The rebuild has to make consistency the default, not something each page re-decides.

## Decisions

Decided 10/18–10/19/2026.

| Decision            | Choice                                                                                        | Reason                                                                                                                                                                                                                                                                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI framework        | Stay on MUI 7                                                                                 | It keeps date pickers, accessible menus and dialogs, and forms integration. The dated feel came from the theme and layouts, not MUI itself.                                                                                                                                                                                                     |
| Component layer     | Tunarr components in `web/src/components/ui/`, plus a ban list of MUI components they replace | Pages still import MUI plumbing (`Box`, `Stack`, `Typography`, `Button`, `TextField`, `Dialog`), styled by the theme. Pass-through wrappers add code without a design decision. The ban list stops pages from hand-rolling the designed patterns.                                                                                               |
| Visual direction    | "Hybrid" mocks: direction A's look with direction B's tools                                   | Chosen 10/18/2026. Canvas: https://claude.ai/artifact/MusrMMnDAuzxk2odbKhRhV (private)                                                                                                                                                                                                                                                          |
| Density             | One app-wide setting, Comfortable or Dense                                                    | Comfortable means visual layouts (cards, poster rows). Dense means tables and tight spacing. Patterns may change their layout by density, not just their sizes. Below `sm`, patterns always use the Comfortable layout, and density still sets sizes. Set in Web Settings and persisted with the theme state. No per-table or per-page toggles. |
| Tokens              | `web/src/themeTokens.ts`, consumed by `web/src/theme.ts`                                      | Colors per scheme, two fonts, one size table per density                                                                                                                                                                                                                                                                                        |
| Fonts               | IBM Plex Sans (variable) and IBM Plex Mono (400, 500, 600) via `@fontsource`                  | Self-hosted, so offline installs work. Mono is for channel numbers, times and durations. Chosen 10/19/2026 from six pairings on the canvas. Plus Jakarta Sans read as generic generated UI, and Plex reads as a technical tool.                                                                                                                 |
| Component workbench | Storybook 10 with the React + Vite builder                                                    | Builds components in isolation, in every state, in both schemes and densities                                                                                                                                                                                                                                                                   |
| Data split          | View components take data as props. Thin wrappers fetch it.                                   | Views become easy to story, test and reuse. Today many components call query hooks inside.                                                                                                                                                                                                                                                      |
| Tables              | The `DataTable` wrapper from `plans/mrt-replacement.md`, in `components/ui/table/`            | TanStack Table v9 owns the state and MUI `Table*` only draws the HTML. It's built now, in parallel with Phases 1 and 2, and styled once to the dense collection mock. Its tables follow the app-wide density.                                                                                                                                   |
| Slot editors        | In scope                                                                                      | Legacy schedules stay after infinite schedules ship, and an unrestyled screen would look broken                                                                                                                                                                                                                                                 |
| Release             | Each phase merges to `main` as it lands                                                       | Theme and shell changes reach every page first, so the gap between rebuilt and old pages stays small. This fits the `main`/`dev` rule in `CLAUDE.md`, because each PR is a small-to-medium change that leaves the app working and needs no prerelease iteration.                                                                                |
| App shell           | Top nav only, no left rail                                                                    | Chosen 10/19/2026 from the two shell mocks. Five sections leave the bar plenty of room. The canvas's "Top bar — how it degrades" board shows the collapse order.                                                                                                                                                                                |
| Top-level sections  | Guide, Channels, Schedules, Library, System. Settings sits at the right end of the bar.       | Schedules holds infinite schedules and the slot library. Sources moves under Settings, which already has a Sources tab. Section pages show as a sub-tab row under the bar.                                                                                                                                                                      |
| Density control     | Settings → General only                                                                       | It is set once and rarely changed, so it does not earn space in the top bar. Color mode keeps a top-bar button.                                                                                                                                                                                                                                 |

## Ban list

- A `no-restricted-imports` rule in `web/.oxlintrc.json` blocks MUI components that have a Tunarr replacement, outside `components/ui/`.
- The PR that adds a replacement bans the MUI component in the same commit.
- Files that already use it go on a legacy list, as an `overrides` entry that turns the ban off for them. Each page rebuild removes its own files.
- If a banned component has a second use the replacement doesn't cover (a `Chip` used as a filter tag, say), add a second primitive rather than narrowing the ban.
- Examples: `Chip` (`StatusPill`), `Table*` and MRT (`DataTable`), `AppBar`/`Drawer`/`BottomNavigation` (`AppShell`), `ToggleButtonGroup` (`Segmented`).

## Layers

Each layer has stories before the layer above uses it.

| Layer      | Examples                                                                                         | Where                        |
| ---------- | ------------------------------------------------------------------------------------------------ | ---------------------------- |
| Tokens     | colors, fonts, radii, density sizes                                                              | `themeTokens.ts`, `theme.ts` |
| Primitives | `StatusPill`, `MonoText`, `KeyHint`, `PageHeader`, `Segmented`, `EmptyState`                     | `components/ui/`             |
| Patterns   | `AppShell`, `CollectionView`, `FormSection`, `MediaGrid`, `LineupEditor`, `Inspector`, `SaveBar` | `components/ui/patterns/`    |
| Pages      | route components assembled from patterns                                                         | `routes/`, `pages/`          |

## Page types

| Type            | Screens | Routes                                                                                                                                                                           |
| --------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App shell       | all     | top nav, ⌘K search, color mode, Settings                                                                                                                                         |
| Collection      | ~9      | `/channels`, `/library/custom-shows`, `/library/fillers`, `/library/smart_collections`, `/library/trash`, `/media_sources`, `/settings/sources`, `/system/tasks`, `/system/logs` |
| Form / settings | ~14     | channel new/edit, custom show and filler new/edit, `/settings/*` tabs, `/settings/ffmpeg/$configId`                                                                              |
| Lineup editor   | 3       | `/channels/$id/programming`, custom show and filler `programming`                                                                                                                |
| Slot editors    | 2       | `/channels/$id/programming/slot-editor`, `time-slot-editor`                                                                                                                      |
| Media browser   | ~4      | `programming/add`, `/media_sources/$id/libraries/$libraryId`, `/search`, `/media/$programType/$programId`                                                                        |
| One-offs        | ~6      | `/guide`, `/channels/$id/watch`, `/welcome`, `/system`, `/system/debug`, `/system/troubleshoot`                                                                                  |

## Storybook

- Lives in `web/.storybook/`. Stories sit next to their component as `*.stories.tsx`.
- Run with `cd web && pnpm storybook`. Build with `pnpm build-storybook`.
- It reuses `web/vite.config.ts`, so path aliases, Lingui and SVG imports work the same as in the app.
- A global decorator wraps every story in the app providers: the MUI theme, Lingui and the date adapter.
- Toolbar controls switch color scheme (light or dark) and density (comfortable or dense) for all stories at once.
- Every primitive and pattern has stories for these states where they apply:
  - default
  - loading, empty, error
  - long text (a 60-character channel name, a 4-digit channel number)
  - both densities and both schemes (through the toolbar)
- Components that cannot split from their data use `msw-storybook-addon` to fake API responses. This is the exception.

## Testing

| Check                      | What it catches                                      | When                                                                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Storybook Vitest add-on    | A story that throws or fails a play function         | Phase 0, in CI with the web tests                                                                                                                                                                                                                             |
| `@storybook/addon-a11y`    | Contrast and role violations against WCAG AA         | Phase 0, in the Vitest run with `a11y.test: 'todo'`, so violations warn and never fail CI. Review the warnings as primitives land. Switching to `'error'` is a later decision.                                                                                |
| Story diff against `main`  | Unintended visual change from a token or theme edit  | Phase 0 adds it. Run on demand, locally. A script builds Storybook from `main` and from the branch, screenshots every story on the same machine in both schemes and densities, and writes an HTML report of the stories that changed. No committed baselines. |
| `e2e/` route sweep         | A rebuilt page that errors against the seeded server | Every page PR, unchanged                                                                                                                                                                                                                                      |
| Side-by-side with the mock | A page that drifts from the agreed design            | Every page PR attaches screenshots of both densities, taken by the story diff script                                                                                                                                                                          |

## Phases

Each phase is one or more PRs against `main`. Each PR leaves the app working.

### Phase 0. Foundation

- Tokens, theme, density setting and self-hosted fonts. Done on branch.
- Density reaches the MRT tables through `useStoreBackedTableSettings`. Done on branch, and temporary until `DataTable` replaces MRT.
- Storybook with the provider decorator and the scheme and density toolbar.
- First primitives with stories: `StatusPill`, `MonoText`, `PageHeader`.
- The Vitest add-on, the a11y add-on (warnings only) and the story diff script.

### Phase 1. Mocks for the remaining page types

- Mock on the canvas, in both densities: app shell, form/settings, media browser, slot editors, and each one-off.
- Add a phone-width frame for every page type, including the existing collection, lineup editor and guide mocks.
- The app shell was mocked twice, top nav only and top nav plus a left rail, and compared side by side. Top nav only won on 10/19/2026.
- Collection, lineup editor and guide mocks exist already.
- Phase 1 does not gate the later phases. Each phase needs its own page type's mock agreed before it starts. Mocking stays one phase ahead, so the next mock is agreed before the current phase ends. The shell mock gates Phase 2.
- The first time a shared pattern appears (`SaveBar`, `Inspector`, `FormSection`), mock it against every page type that uses it.

### Phase 2. App shell

- `AppShell` with top navigation, ⌘K search, color mode and Settings. Density stays in Settings → General.
- Sections are Guide, Channels, Schedules, Library and System. Library, System, Schedules and Settings show their pages as a sub-tab row.
- Sources moves into Settings as its second tab. `/media_sources` redirects there.
- The Schedules section appears when the infinite schedules web pages land (`architecture/infinite-schedules/README.md`, phase 7).
- The bar degrades in a fixed order as it narrows. The search pill becomes an icon below about 1000 px, then the wordmark drops, then sections that don't fit move under More from the right. The active section always stays visible.
- Replaces the left drawer and `TopBar` on every route at once.
- ⌘K matches nav pages, settings tabs, channels, custom shows, filler lists and smart collections by name, all from data the app already loads. Its last row, "Search library for '…'", opens `/search` with a query built by the structured `SearchFilter` builder. Inline program results are out of scope for now.
- Phone layout keeps a bottom nav bar with five items: Guide, Channels, Schedules, Library and More (System, Settings). Section pages show as a chip row.

Built on `feat/app-shell` (10/19/2026):

- Views live in `web/src/components/ui/patterns/AppShell/`. Data wrappers live in `web/src/components/shell/`. The nav tree is `useShellNav.tsx`, so Schedules is one more entry in `sections`.
- Settings is a gear icon at the right end of the bar.
- XMLTV/M3U copy, Docs, GitHub, Discord and the version line moved from the old `TopBar` into one help menu, a "?" button beside color mode. The phone header has the same button.
- System keeps the health-check badge.
- Library gained a Libraries tab (`/library`) that the mock doesn't show. System tabs follow the mock order: Status, Tasks, Logs, Debug, Troubleshoot.
- The phone layout starts below MUI's `sm` breakpoint (600 px). The bottom bar shows up to five items and folds the rest under More.
- `no-restricted-imports` in `web/.oxlintrc.json` bans `AppBar`, `Drawer`, `SwipeableDrawer` and `BottomNavigation` outside `components/ui/`. `SelectedProgrammingList.tsx` is exempt until its page is rebuilt.
- Page sticky offsets still use the fixed 64 px `TopBarPadddingPx`. The dense bar is shorter, so dense pages show a small gap under sticky headers.

### Phase 3. Collection pages

- Needs `DataTable` from `plans/mrt-replacement.md` Phase 0. That phase runs in parallel with Phases 1 and 2.
- `CollectionView` switches between cards (Comfortable) and a table (Dense). It holds the bulk-selection bar and keyboard hints.
- Pilot is `/channels`, which also needs a "now playing" field per channel. `GET /api/channels/all/lineups?from=<now>&to=<now>` supplies it in one call. It reads the in-memory guide cache (`TvGuideService.getChannelLineup`), so it needs no new endpoint.
- Then the other collection routes.

### Phase 4. Forms and settings

- `FormSection`, field rows and a sticky `SaveBar`, built for React Hook Form.
- All settings tabs, then the entity new/edit pages.

### Phase 5. Media browser

- `MediaGrid` and filters for Add Media, library views and search, plus the media details page.

### Phase 6. Lineup editor

- `LineupEditor` with poster rows (Comfortable), a table (Dense), the `Inspector` panel and the `SaveBar`.
- Shared by channel, custom show and filler programming.
- Coordinate with `plans/channels-lineup-lazy-loading.md`. Its server-side drafts change how the editor loads and saves, and they also ship on `main`.
- The `LineupEditor` view takes a window of rows, a total count, and edit callbacks (move, remove, add), not one full array. Today's wrapper serves it from the in-browser lineup. When drafts land, only the wrapper changes, and it reads pages from the server.
- Drafts add three UI pieces, each with its own stories. They are a "draft" badge on the channel, custom show and filler lists, a resume-or-discard banner in the editor, and a drafts list in Settings. Phase 3's collection cards leave room for the badge.

### Phase 7. Slot editors

- Time-slot and random-slot editors on the shared patterns.
- Coordinate with `plans/mrt-replacement.md` Phase 3, which ports their tables.

### Phase 8. One-offs

- Guide (comfortable and dense mocks exist), Watch, Welcome, and the System pages.

### Phase 9. Lock-in

- Every legacy list in the ban-list lint rule is empty. Delete the lists.
- Remove per-page `sx` colors that duplicate tokens.
- Update `.claude/.codebase-info/` and `CLAUDE.md` with the component layer rules.

## Rules for rebuilt pages

- Use a `components/ui/` component wherever one exists. Never use a banned MUI component. If a page hand-styles something the design covers, a primitive is missing, so add it there with stories.
- No hex colors or pixel sizes in pages. Use theme values or tokens.
- Numbers, times and durations use `MonoText`.
- Every page works in both densities and both schemes before merge.
- Views take data as props. Fetching stays in the route or a thin wrapper.

## Related plans

- `plans/mrt-replacement.md` builds the table this plan uses. Its "Density toggle: drop" decision now means tables follow the app-wide setting.
- `plans/channels-lineup-lazy-loading.md` changes lineup loading and saving under Phase 6.
- `plans/frontend-audit-plan.md` covers state-ownership defects. Rebuilt pages should not copy the patterns it lists, such as syncing state through `useEffect`.

## Risks

| Risk                                                       | Mitigation                                                                                                                                                   |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Rebuilt and old pages look mismatched for several releases | Theme and shell land first and restyle every page. Ship page types in quick succession.                                                                      |
| Stories drift from real usage                              | Stories run as tests in CI, and the ban list keeps pages on the same components                                                                              |
| The canvas mocks are HTML and drift from code              | Once a pattern exists in Storybook, Storybook is the source of truth and the mock is retired                                                                 |
| Scope creep into behavior changes                          | Rebuild PRs change layout, components, and the view/data split. They keep query hooks, keys and invalidation unchanged. Behavior changes go in separate PRs. |
| MUI 9 upgrade lands mid-redesign                           | The wrapper layer uses only MUI 9-safe APIs (`slotProps`, `sx`), as `plans/mrt-replacement.md` requires                                                      |

## Open questions

- None open. Settings placement was settled as a gear icon (10/19/2026).
