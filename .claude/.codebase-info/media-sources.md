# Media Sources

*Last Updated: 2026-09-29*

## Clients (`server/src/external/`)

| Source | Location |
|--------|----------|
| Plex | `external/plex/` |
| Jellyfin | `external/jellyfin/` (`JellyfinApiClient.ts`) |
| Emby | `external/emby/` (`EmbyApiClient.ts`) |
| Shared | `BaseApiClient.ts`, `MediaSourceApiClient.ts`, `MediaSourceApiFactory.ts`, `Redacter.ts` (log redaction) |

Each client canonicalizes the server's response into Tunarr's program model. Jellyfin and Emby
report durations as `RunTimeTicks` (100 ns units), so their canonicalizers divide by 10,000 to get
milliseconds. Plex reports integer milliseconds.

Response schemas for the external servers live in `types/src/plex/`, `types/src/jellyfin/`, and
`types/src/emby/`.

## Scanning (`server/src/services/scanner/`)

- `MediaSourceScanCoordinator.ts` runs scans. `MediaSourceProgressService.ts` reports progress.
- One scanner per source and library type, for example `PlexMediaSourceTvShowScanner.ts`,
  `JellyfinMediaSourceMovieScanner.ts`, `EmbyMediaSourceMusicScanner.ts`.
- Local folders: `Local*Scanner.ts` plus `FileSystemScanner.ts` and `imageFileLookup.ts`. NFO
  metadata parsing is in `server/src/nfo/`. `services/local/` holds local-source helpers.
- Collections: `ExternalCollectionScanner.ts` and the per-source `*CollectionScanner.ts`.
- Base classes: `MediaSourceScanner.ts`, `MediaSourceMovieLibraryScanner.ts`,
  `MediaSourceTvShowLibraryScanner.ts`, and the music and other-video equivalents.

Scans write through `server/src/db/program/ProgramUpsertRepository.ts` and
`ProgramGroupingUpsertRepository.ts`, then update the Meilisearch index.

## Configuration

- Media source rows: `db/schema/MediaSource.ts`, `MediaSourceLibrary.ts`, and
  `MediaSourceLibraryReplacePath.ts` (path rewriting for direct file access).
- API: `api/mediaSourceApi.ts`, `api/plexApi.ts`, `api/jellyfinApi.ts`.
