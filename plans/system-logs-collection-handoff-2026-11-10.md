# Handoff: `/system/logs` in the web redesign

> **Status (11/11/2026):** Built on `feat/logs-collection`. The user chose option B plus option C's pause toggle after comparing mocks. The folder is `web/src/components/system/system-logs/`, because `web/.gitignore` ignores folders named `logs`. See the "Built on `feat/logs-collection`" note in `plans/web-redesign.md` for what shipped.

## Context

- Phase 3 of `plans/web-redesign.md` moves collection pages onto `CollectionView`. Comfortable density shows cards, Dense shows a `DataTable`, and phones always get cards.
- Done so far: `/channels`, `/library/custom-shows`, `/library/fillers`, `/library/smart_collections`, `/settings/sources`, `/system/tasks`. Each has its own stacked PR. Read the "Built on …" notes in the plan for the conventions they set.
- The plan lists `/system/logs` as the last collection page. It may not be one. See "Layout decision".

## Working rules

- Work only in `/home/christian/Code/tunarr/.claude/worktrees/logs-collection`. Never edit the main checkout.
- Serena is bound to the main checkout. Use built-in Read/Edit and bash with absolute worktree paths.
- Commit only when the user asks. End commits with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Open the PR with the `/pr` skill, based on `feat/tasks-collection`, with the PR template filled in. Write the title in words a user would notice.
- `gh pr edit` fails on this repo. Edit PRs with `gh api -X PATCH repos/chrisbenincasa/tunarr/pulls/<n> -F body=@file`.
- List behavior changes and open questions in the PR body.
- A fresh worktree needs `pnpm i` and a `@tunarr/types` and `@tunarr/shared` build before web tests and e2e run.

## Current page

| Item   | Detail                                                                                                    |
| ------ | --------------------------------------------------------------------------------------------------------- |
| Route  | `web/src/routes/system/logs.tsx` renders `SystemLogsPage`                                                 |
| Page   | `web/src/pages/system/SystemLogsPage.tsx` (194 lines), all logic inline                                   |
| Tests  | `web/src/pages/system/SystemLogsPage.test.tsx`, with a `FakeEventSource`                                  |
| e2e    | `SystemLogs` entry in `e2e/tests/tables.spec.ts`, `ready: 'info'`, `persisted: false`                     |
| Data   | `EventSource` on `GET /api/system/debug/logs` (`server/src/api/systemApi.ts:466`)                         |
| Buffer | Newest first, capped at 1000 lines, parsed client side                                                    |
| Table  | Timestamp (ISO string), Level (multi-select filter), Component, Message. Page size 50, no saved settings  |
| Header | A paragraph with the live count, plus "Download last N rows" and "Download all logs" links in the toolbar |

The server tails the last 1 MB of `tunarr.log` and sends each line as an SSE `message`. Downloads use the same route with `download=true&pretty=true`, which returns pino-pretty text.

## Log line shape

Each line is a pino JSON object. A sample from a dev log:

```json
{
  "level": 30,
  "time": 1794227998253,
  "pid": 2088607,
  "hostname": "zeus",
  "caller": "UpdateXmlTvTask",
  "task": "UpdateXmlTvTask",
  "msg": "XMLTV Updated at 2026-11-09T07:39:58-05:00"
}
```

| Field             | Notes                                                                       |
| ----------------- | --------------------------------------------------------------------------- |
| `level`           | 10 trace, 20 debug, 25 http, 30 info, 40 warn, 50 error, 60 fatal           |
| `time`            | Epoch milliseconds                                                          |
| `caller`          | Class or task name. The page shows it as Component                          |
| `msg`             | In a 71-line sample, median 26 chars, p95 82, max 163                       |
| `pid`, `hostname` | Same on every line. Not worth showing                                       |
| `err`             | On error lines. pino's default serializer writes `{ type, message, stack }` |
| Others            | Free-form context such as `task`, `worker`, `category`, request fields      |

The page keeps only time, level, caller and msg. It drops `err`, so a user debugging a failure sees "Scan failed" and never the stack. `LogLine` has `fullLine` and `extraData` fields, but nothing reads them.

## Layout decision

The user asked whether logs need a different approach because the data is more structured. The answer is yes, for these reasons.

- Cards suit entities. Every page so far lists things with a name, facts and actions (edit, delete, run, open). A log line has no identity, no actions and no detail page.
- Logs are read by scanning down a time column. That needs aligned rows. A card grid at Comfortable fits 6 to 9 entries per screen against 25 or more rows, and it reads left to right.
- The list is live. New lines arrive at the top and push every entry down. In a multi-column grid each new line moves every card to a new column.
- The structure that matters is per line, in `err` and the context fields. It belongs in an expandable row, not a card face.

### Options

|     | Option                                       | What it means                                                                                                                                                               | Cost                                                                |
| --- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A   | Cards at Comfortable, like the other pages   | A `LogEntryCard` per line through `CollectionView`                                                                                                                          | Small. Worst to read, for the reasons above                         |
| B   | Table in every density, with expandable rows | `CollectionView` with `layout` forced to `table` on desktop. Phones get a compact two-line entry through `renderCard`. Rows expand to show `err.stack` and the other fields | Medium. Keeps `DataTable` filters, column hiding and the e2e spec   |
| C   | A purpose-built log console                  | A new `LogView` pattern: one mono line per event, virtualized with `react-window` (already a dependency), follow and pause, level chips, search                             | Large. A new pattern, which the plan's rules say needs a mock first |

**Recommendation: B.** It fits the data, reuses the table work, and still gives phones a readable layout. C can follow in Phase 8 ("System pages") if a console is wanted. Record the user's choice in the plan before starting.

If the user picks B, the plan's Page types table should move `/system/logs` out of Collection or footnote it, and the Phase 3 note should say why.

## Work plan for option B

### Files

- `web/src/components/system/logs/logLine.ts`
  - `LogLevel` union, `parseLogLine(data: string): LogLine | undefined`, and the level number map.
  - `LogLine` keeps `id` (a running counter, so rows have stable keys), `time`, `level`, `caller`, `msg`, `err` and `context` (the remaining fields minus `pid` and `hostname`).
  - Switch over the level union with a `case` per member and no `default` (CLAUDE.md rule).
- `web/src/components/system/logs/LogLevelPill.tsx`
  - `StatusPill` mapping. Suggested: error and fatal map to `error`, warn to `warning`, info to `live` or `idle` (pick by eye), debug, trace and http to `idle`.
- `web/src/components/system/logs/LogDetail.tsx`
  - The expanded row body. Shows `err.type`, `err.message` and `err.stack` in `MonoText` with preserved whitespace, then the context fields as a key and value list.
- `web/src/components/system/logs/LogEntry.tsx`
  - The phone layout. Line one holds the time, level pill and caller. Line two holds the message, clamped to 3 lines. Tapping expands `LogDetail`.
- `web/src/components/system/logs/SystemLogsView.tsx`
  - Props only. `lines: LogLine[]`, `downloadUrls: { last: string; all: string }`, `layout?: CollectionLayout`.
  - `PageHeader` "Logs" with the explainer as the subtitle and the two download links as actions.
  - Columns: Time (`MonoText`, local time, sortable), Level (pill, multi-select filter), Component, Message. Messages wrap.
  - An `EmptyState` for "No log lines yet".
- `web/src/components/system/logs/SystemLogsView.test.tsx` and `SystemLogsView.stories.tsx`.
- `web/src/pages/system/SystemLogsPage.tsx`
  - Keeps the `EventSource`, the buffer and the URLs. Uses `parseLogLine`. Renders the view.
- `web/src/pages/system/SystemLogsPage.test.tsx`
  - Trim it to wiring: stream URL, parse and cap, newest first, close on unmount. Move the filter and render tests to the view test.

### Things to check in `DataTable`

- Whether it supports expandable rows. If not, decide between adding `getRowCanExpand` and a `renderDetail` prop to `DataTable`, or opening the detail in a side `Drawer`. A `DataTable` change touches every table, so give it its own tests and a story.
- How a row click and the expand control interact. Rows open nothing else, so a row click can toggle expansion.
- Whether to save table settings with `useStoreBackedTableSettings('SystemLogs')`. The other pages do. The e2e entry sets `persisted: false`, so flip it if you add this.

### Stories

FollowsDensity, Table, Phone (forced `cards` layout), LongText (a wrapped message and a long stack), WithError (an expanded error line), Empty, EmptyTable, and a play that expands a row and checks the stack shows.

### Tests

- `parseLogLine`: each level, an unknown level, non-JSON, a line with `err`, and context fields that keep everything except `pid` and `hostname`.
- View: level pills, the level filter, the expanded detail, the empty state, and the download hrefs.
- Page: the wiring listed above.

### e2e

- Keep the `SystemLogs` entry in `e2e/tests/tables.spec.ts` working at both densities, because the table now shows at Comfortable too.
- The route sweep fails on `console.error`, so watch for key warnings from the expandable rows.

### Checks before committing

- `pnpm lint-changed` and `pnpm exec prettier --write <changed files>`
- `pnpm typecheck` in `web`
- Web unit and Storybook tests (`pnpm test` in `web`)
- `pnpm story-diff --base origin/feat/tasks-collection --filter system-systemlogsview` for screenshots in both themes and densities. The filter matches lowercase story ids.
- `cd e2e && pnpm e2e tests/tables.spec.ts tests/routeSweep.spec.ts -g "table SystemLogs|/system/logs"`
- Unrelated tests sometimes fail under load. Rerun them alone before blaming the change.

## Open questions for the user

- Which layout: A, B or C?
- The live buffer is newest first and paged at 50. New lines shift page 1 while the user reads it. Add a pause or follow toggle now, or leave it for option C?
- Should the page show `debug` and `trace` lines by default, or start filtered to info and above?
- Timestamps show as ISO strings today. Switch to local time in the `llll` format like the tasks table, keeping the ISO value in a tooltip?
