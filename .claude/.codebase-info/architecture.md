# Architecture

*Last Updated: 2026-09-29*

## Components

```
                ┌──────────── web (React SPA, served by the server at /web) ────────────┐
                │ routes/ (TanStack file routes) → generated/ API client → server REST  │
                └───────────────────────────────────────────────────────────────────────┘
                                              │ HTTP
┌─────────────────────────────── server (Fastify) ──────────────────────────────────────┐
│ api/*Api.ts ──► services/ ──► db/ (repositories) ──► SQLite  +  channel-lineups/*.json │
│      │               │                                                                 │
│      │               ├─► external/ (Plex, Jellyfin, Emby clients)                      │
│      │               └─► MeilisearchService (search index subprocess)                  │
│      └─► stream/ (sessions) ──► ffmpeg/ (pipeline builder → FFmpeg process)            │
│ tasks/ (scheduled jobs: scans, XMLTV, fixers)   services/TunarrWorkerPool (workers)    │
└────────────────────────────────────────────────────────────────────────────────────────┘
   types/ (Zod schemas + TS types)  and  shared/ (utils, search DSL) are used by both sides
```

## Boundaries

- **`types/`** is the contract between server and web. API schemas live in `types/src/api/` and
  `types/src/schemas/`.
- **`server/src/container.ts`** wires every service through Inversify modules (`*Module.ts`).
  Keys live in `server/src/types/inject.ts`.
- **External media servers** are reached only through `server/src/external/`. Their payloads
  are canonicalized into Tunarr's own program model before they touch the DB.
- **FFmpeg** is reached only through `server/src/ffmpeg/`. Stream code asks for a pipeline and
  never builds argument lists by hand.

## Main flows

| Flow | Path |
|------|------|
| Watch a channel | `api/streamApi.ts` → `stream/SessionManager.ts` → HLS or concat session → `ProgramStream` per lineup item → `ffmpeg/FfmpegStreamFactory.ts` → `ffmpeg/builder/` |
| Build a schedule | web slot editor → `api/channelsApi.ts` → `services/scheduling/*SchedulerService.ts` → `db/channel/LineupRepository.ts` writes the lineup JSON |
| Scan a library | `tasks/ScanLibrariesTask.ts` → `services/scanner/MediaSourceScanCoordinator.ts` → per-source scanner → `external/*ApiClient` → `db/program/*UpsertRepository.ts` → Meilisearch index |
| Guide / EPG | `tasks/UpdateXmlTvTask.ts` → `services/TvGuideService.ts` → `services/XmlTvWriter.ts` |
| Search | web search bar → `shared/src/util/searchUtil.ts` (Chevrotain DSL parser) → `services/search/SearchParser.ts` → `services/MeilisearchService.ts` |

See [streaming.md](./streaming.md), [scheduling-and-lineups.md](./scheduling-and-lineups.md), and
[media-sources.md](./media-sources.md) for detail.
