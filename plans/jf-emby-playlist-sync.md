# Jellyfin & Emby playlist sync for custom shows

## Context
Custom shows can currently sync from Plex playlists only (commit `c07da89b6` and fixes #1888, #1895, `629ba248f`). Users on Jellyfin and Emby want the same thing: link a custom show to a server playlist, keep it in sync on the library rescan schedule, and preserve playlist order.

Most of the pipeline doesn't depend on the source type: the DB columns, `CustomShowDB.upsertCustomShowContent`, `SyncCustomShowsTask`, the API endpoints, and `CustomShowSyncService.ensureProgramsExist` (which works through per-source `scanSingle` scanners, and Jellyfin/Emby scanners already exist). Plex is hard-wired in these places:
- `fetchPlaylistPrograms` switches on the source type and throws for anything but Plex.
- The type enums (`'plex'`) in the Drizzle schema and in Zod.
- The web form filters media sources to Plex and queries Plex playlists.
- The Jellyfin/Emby API clients have no methods for listing playlists or fetching playlist items.

**Main problem:** Jellyfin/Emby item conversion sets `libraryId: ''` ("We can't know this at this point"), and `ensureProgramsExist` skips any program whose `libraryId` isn't a known library. Plex gets `libraryId` from `librarySectionID`. Jellyfin/Emby need an explicit step that resolves each item's library. Tracks also have no `artist` join, which the track branch uses for grouping.

## Server

### 1. API clients: list playlists and fetch playlist items
`server/src/external/jellyfin/JellyfinApiClient.ts` and `server/src/external/emby/EmbyApiClient.ts`:
- `getPlaylists(pageParams?)`: `GET /Items?userId&IncludeItemTypes=Playlist&Recursive=true`. Keep only `MediaType` Video/Audio (drop Photo/Book) and map to the `Playlist` type from `types/src/schemas/programmingSchema.ts:531`: `externalId = Id`, `childCount = ChildCount`, `sourceType`, `mediaSourceId`, `libraryId: ''`. Add `'Playlist'` handling in the item schemas if it's missing.
- `getPlaylistItems(playlistId): Promise<Result<TerminalProgram[]>>`:
  - Jellyfin endpoint: `GET /Playlists/{id}/Items?userId&startIndex&limit&fields=…`
  - Emby endpoint: `GET /Playlists/{id}/Items?UserId&StartIndex&Limit&Fields=…`
  - Page through the results with the same `fields` that `getRawItems` already requests, then convert with the existing `jelllyfinApiItemInjection` / `embyApiItemInjection`. Drop non-terminal or unsupported item types with a warning.
  - Keep the Plex client's behavior: if any page fails, the whole call returns a failure, so sync never replaces show content with a truncated list.
- `getItemAncestors(itemId)`: `GET /Items/{id}/Ancestors?userId`. Both servers support it. It returns the ancestor chain, whose `CollectionFolder` entry is the library.
- While in the Emby client, remove the stray `console.log('getting items', …)`.

### 2. Track artist join
In the Jellyfin/Emby track injections (`jellyfinApiTrackInjection` ~`JellyfinApiClient.ts:1739`, Emby ~`:1762`), populate `artist` from `AlbumArtists[0]` / `ArtistItems[0]` the same way episodes populate `show` from `SeriesId` (~`:1504`). The existing track branch of `ensureProgramsExist` then groups by `artist.externalId` and calls the music scanner's `scanSingle` with that id. Check that `MediaSourceMusicArtistScanner.scanSingle` for Jellyfin/Emby expects an artist id.

### 3. Resolve library IDs
Add `server/src/services/JellyfinEmbyHierarchyTraversal.ts` (a sibling of `PlexHierarchyTraversal` in `PlexItemEnumerator.ts`). It takes a client with `getItemAncestors` (a small interface both clients satisfy) plus the media source's libraries, and exposes `resolveLibraries(items: TerminalProgram[])`:
- Group items by their "scan root": `show.externalId` for episodes, `artist.externalId` for tracks, and the item's own `externalId` for everything else. Call `getItemAncestors` once per root, with the same 3-way concurrency as the Plex traversal.
- Find the ancestor whose `Id` equals some `library.externalKey` and set `item.libraryId = library.uuid` on every item in that group.
- If there's no match (e.g. the library is untracked), leave `libraryId` empty. `ensureProgramsExist` already skips those items. Log a warning with a count.

### 4. `CustomShowSyncService`
`server/src/services/CustomShowSyncService.ts`:
- Add `case 'jellyfin'` and `case 'emby'` to `fetchPlaylistPrograms`. Both call one shared helper that:
  1. gets the client via `mediaSourceApiFactory.getJellyfinApiClientById` / `getEmbyApiClientById`
  2. calls `getPlaylistItems(...).getOrThrow()`
  3. loads the media source's libraries (`mediaSourceDB.getById`)
  4. runs `resolveLibraries`
  5. restores playlist order with the same `idxById` + `sortBy` logic as the Plex path. Extract that into a small shared function so the two paths don't duplicate it.
- Type `sourceType` as the sync source type union instead of `string`.

### 5. API endpoints
- `server/src/api/jellyfinApi.ts`: add `GET /jellyfin/:mediaSourceId/playlists`, modelled on `server/src/api/plexApi.ts:216`.
- `server/src/api/embyApi.ts`: add the equivalent `GET /emby/:mediaSourceId/playlists`.
- Both return the paged `Playlist` shape the Plex route returns.

### 6. Types and schema (no SQL migration)
`sync_media_source_type` is already a plain `text` column, so only the TypeScript types change:
- `server/src/db/schema/CustomShow.ts`: `$type<'plex'>()` becomes `$type<'plex' | 'jellyfin' | 'emby'>()`.
- `types/src/schemas/customShowsSchema.ts:8`: `CustomShowSyncMediaSourceTypeSchema = z.enum(['plex','jellyfin','emby'])`.
- `types/src/api/index.ts:93`: reuse `CustomShowSyncMediaSourceTypeSchema` instead of the inline `z.enum(['plex'])`.

### 7. Regenerate the API
`cd server && pnpm generate-openapi`, then `cd web && pnpm generate-client` (the `regen-api` skill).

## Web
`web/src/components/custom-shows/EditCustomShowForm.tsx`:
- Line 132: allow `plex`, `jellyfin` and `emby` sources.
- Lines 135-144: choose the playlists query from the selected source's type (`getApiPlexByMediaSourceIdPlaylists` / the new Jellyfin and Emby queries). One small `useMediaSourcePlaylists(source)` hook keeps the component simple; each query gets `enabled` only for its own type.
- Line 163: send the selected source's type instead of `'plex' as const`.
- Clear `syncExternalPlaylistId` when the media source changes, if the form doesn't already do that.
- Run `pnpm lingui extract` if any strings change.

## Docs
`docs/configure/library/custom-shows.md` "External Sync":
- List Plex, Jellyfin and Emby as supported sources.
- Note that items must belong to a library Tunarr tracks; items from other libraries are skipped.
- Note that Jellyfin/Emby photo and book playlists aren't listed.

## Tests
- `server/src/services/CustomShowSyncService.test.ts`: add Jellyfin and Emby cases:
  - order is preserved
  - episodes are grouped by show
  - tracks are grouped by artist
  - items whose library can't be resolved are skipped
  - a failed `getPlaylistItems` doesn't touch existing content
- New `JellyfinEmbyHierarchyTraversal.test.ts`: ancestor matching, one ancestors call per root, and the unmatched-library case.
- Client tests for `getPlaylistItems` paging and failure handling, modelled on `PlexApiClient.test.ts:147-411`, where the Jellyfin/Emby clients already have test scaffolding.

## Verification
1. `pnpm turbo typecheck`, `pnpm lint-changed`, `pnpm turbo test` (or the `check` skill).
2. Manual test with `pnpm turbo dev` against real Jellyfin and Emby servers. For each server, create a playlist that mixes movies, episodes from two shows, and music tracks, then:
   1. Create a custom show linked to it and confirm the content matches the playlist's order.
   2. Reorder and remove items in the server playlist, click "Sync Now", and confirm the changes show up.
   3. Add an item from an untracked library and confirm it's skipped with a warning.
   4. Schedule the show on a channel and confirm playback.
3. Confirm Plex sync still works the same (regression check).
