# Database

*Last Updated: 2026-09-29*

## Stores

| Store | What it holds | Code |
|-------|---------------|------|
| SQLite (`better-sqlite3`) | Channels, programs, groupings, media sources, filler, custom shows, transcode configs, play history | `server/src/db/` |
| Lineup JSON files (lowdb) | Per-channel lineups and schedules | `db/channel/LineupRepository.ts` |
| Settings JSON | App settings | `db/SettingsDB.ts`, `db/SettingsDBFactory.ts` |
| Meilisearch | Program search index | `services/MeilisearchService.ts`, `services/search/` |

## Schema and migrations

- The Drizzle schema is in `server/src/db/schema/`, one file per table (`Program.ts`, `Channel.ts`,
  `ProgramGrouping.ts`, `ProgramMediaStream.ts`, and so on). `index.ts` re-exports them.
- `server/drizzle.config.ts` generates SQL into `server/src/migration/db/sql/` (snake_case
  columns). Use `/new-migration`, and `/resolve-drizzle-migrations` after a merge conflict.
- `server/src/migration/db/` also holds the older Kysely-era TypeScript migrations
  (`LegacyMigration*.ts`, `Migration<timestamp>_*.ts`), loaded through
  `migration/DirectMigrationProvider.ts`. `migration/DrizzleMigrator.ts` applies the Drizzle SQL.
- `migration/lineups/` migrates lineup JSON files. `migration/streamCache/` clears cached stream state.

## Access layer

- Repositories are grouped by domain in `db/channel/` and `db/program/`. `ChannelDB.ts` and
  `ProgramDB.ts` are facades over them.
- Interfaces live in `db/interfaces/`. Kysely-to-API converters live in `db/converters/`.
- Kysely uses `CamelCasePlugin`. Drizzle uses `snake_case` casing. Both come from `DBAccess`.
- Backups: `db/backup/`.

Known quirk: `program.duration` and `channel.duration` are `INTEGER` columns, but Jellyfin and Emby
canonicalization can write fractional milliseconds (issue #2032).
