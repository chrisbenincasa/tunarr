# Entry Points

*Last Updated: 2026-09-29*

## Process start

| File | Role |
|------|------|
| `server/src/index.ts` | yargs CLI root. Loads env, sets global options, registers commands from `cli/commands.ts` |
| `server/src/cli/RunServerCommand.ts` | Default command. Boots the HTTP server |
| `server/src/bootstrap.ts` | Initializes DB directory, migrations, and container before the server starts |
| `server/src/App.ts`, `server/src/Server.ts` | Fastify app construction and listen |
| `server/src/cli/StartWorkerCommand.ts` | Starts a worker process. The pool lives in `services/TunarrWorkerPool.ts` |
| `server/src/services/StartupService.ts` + `services/startup/` | One-time startup tasks after boot |

## CLI (`pnpm tunarr <cmd>` from `server/`)

- `cli/database/` — list, migrate up/down, migrate to latest
- `cli/settings/` — view and update settings
- `cli/runFixerCommand.ts` — run a fixer from `tasks/fixers/`
- `cli/GenerateOpenApiCommand.ts` — writes the OpenAPI spec used by `web/src/generated/`

`server/src/commands/` holds internal command objects (materialize lineup, regenerate lineup,
force scan). They are called from services and APIs, not from the CLI.

## HTTP

- `server/src/api/index.ts` registers every `*Api.ts` route file.
- Streaming routes are in `api/streamApi.ts`: `/stream/channels/:id`, `/stream/channels/:id.ts`,
  `/stream/channels/:id/radio.ts`, `/stream/channels/:id/:sessionType/:file`,
  `/stream/channels/:id/item-stream.ts`.
- HDHomeRun emulation is in `api/hdhrApi.ts`. Debug-only routes are in `api/debug/`.

## Background work

- `server/src/tasks/TaskRegistry.ts` registers tasks. `ScheduledTask.ts` handles cron timing.
- Notable tasks: `ScanLibrariesTask`, `UpdateXmlTvTask`, `RefreshMediaSourceLibraryTask`,
  `ReconcileProgramDurationsTask`, `SubtitleExtractorTask`, `OnDemandChannelStateTask`.
- `tasks/fixers/` holds one-shot data repair jobs.

## Web

- `web/src/main.tsx` → `web/src/App.tsx`. Router is built in `web/src/router.ts` from the
  generated `routeTree.gen.ts`.
- Route folders under `web/src/routes/`: `channels_`, `guide`, `library`, `media_`,
  `media_sources_`, `search`, `settings`, `system`, `welcome`.
