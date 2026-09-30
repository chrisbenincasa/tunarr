# Codebase Map — Tunarr

*Last Updated: 2026-09-29*

Tunarr builds live TV channels from Plex, Jellyfin, Emby, and local media, and serves them as
HLS/MPEG-TS streams, M3U playlists, XMLTV guides, and an emulated HDHomeRun tuner.

**Stack:** TypeScript · Node 22 · Fastify · Inversify · SQLite (Drizzle + Kysely) · Meilisearch · FFmpeg · React 18 + MUI + TanStack
**Shape:** pnpm/Turbo monorepo — `server`, `web`, `types`, `shared`

`CLAUDE.md` already covers commands, code style, and the DI/ORM basics. These docs cover what it
doesn't: where flows start, how streaming and scheduling actually work, and where data lives.

## Documents

| Document | What's inside |
|----------|---------------|
| [architecture.md](./architecture.md) | Components, boundaries, and the main end-to-end flows |
| [entry-points.md](./entry-points.md) | CLI commands, HTTP route files, workers, scheduled tasks |
| [streaming.md](./streaming.md) | Stream routes → sessions → program streams → FFmpeg pipeline builder |
| [scheduling-and-lineups.md](./scheduling-and-lineups.md) | Slot schedulers, program iterators, lineup JSON files |
| [media-sources.md](./media-sources.md) | Plex/Jellyfin/Emby/local clients, scanners, canonicalization |
| [database.md](./database.md) | Drizzle schema, migrations, repositories, non-SQL stores |
| [testing.md](./testing.md) | Vitest layout, integration test server, where fixtures live |

## How to use this map

- Before touching code, skim the doc for the area you're changing.
- These docs hold concrete file paths. Use them to jump straight to the code.
- `CONTEXT.md` (repo root) is the domain glossary for channel programming terms.

## Keeping this map current

After a change that affects architecture, directory structure, dependencies, the data model, entry
points, APIs/events, or conventions, refresh the affected docs with the `update-codebase-map` skill
(`/codebase-mapper:update-codebase-map`). Small, internal-only changes don't need an update.
