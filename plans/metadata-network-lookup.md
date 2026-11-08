# Network lookup

> **Status (11/08/2026):** Draft design, not started. Fetchers ship in core, TMDB is the v1 provider, and the preset's studio fallback is configurable (all decided 11/08/2026). TVDB is tracked as a follow-up pending its subscriber-key model.

## Goal

- Record the networks each TV show aired on, separately from its studios.
- Record which sources reported each studio and network, with their external IDs.
- Expose them as a search and filter field so users can build their own network channels.
- Feed the Network Channel preset (draft PR #1805, `channels-auto-channel-presets.md` §2.5) and issue #850.
- Users supply their own provider credentials.

## Non-goals

- Deciding which network a show aired on first. Users filter on any network a show aired on.
- Movies. They have studios and production companies, not networks.
- Per-season networks.
- Replacing studio data that comes from media servers.
- Building a plugin system. See "Core vs plugin".
- Looking up shows by title. v1 only uses external IDs we already have (decided 11/08/2026).

## Why not `studio`

- `studio` (`server/src/db/schema/Studio.ts`) is a flat list of names with no role column.
- Plex, Jellyfin, Emby, and NFO files all feed it, and some mix networks with production companies.
- Filtering on `studio` for "NBC" also matches shows NBC only produced.

## Providers

|                     | TMDB                                                                                    | TVDB v4                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Credential          | API key or read access token, from any TMDB account                                     | API key, plus an optional subscriber PIN (`POST /login` takes `apikey`, `pin`)              |
| User cost           | Free for non-commercial use                                                             | $11.99/year subscription for the PIN model                                                  |
| Network data        | `networks[]`, kept apart from `production_companies[]`                                  | `companies.network[]`, plus `originalNetwork` and `latestNetwork` on `SeriesExtendedRecord` |
| Lookup with our IDs | `GET /3/tv/{tmdbId}`, or `GET /3/find/{id}` with `external_source=tvdb_id` or `imdb_id` | `GET /series/{tvdbId}/extended`, or `GET /search/remoteid/{imdbId}`                         |
| Rate limit          | Roughly 40 req/s, honor `429`                                                           | None stated, and "excessive calls" are banned                                               |
| Cache limit         | At most 6 months (Terms §1.C)                                                           | None, and heavy caching is encouraged                                                       |
| Attribution         | TMDB logo plus the Terms §3 notice in an About or Credits section                       | "Metadata provided by TheTVDB" with a link, wherever the data is shown                      |

TMDB is the preferred provider and the only one in v1. It's free, and its `networks` list is enough for filtering. TVDB is a tracked follow-up until TVDB support answers whether we can ship a subscriber-supported key (see "TVDB exception").

## Credentials

### Why users bring their own key

- Shipping a key doesn't keep it secret. It sits in the pkg executable and the Docker image, where `strings` or unpacking finds it. The server also sends it on every request, and users can capture traffic from their own machine.
- Injecting the key at build time keeps it out of git and nothing more.
- TMDB's license is "non-transferable, non-sublicensable" (Terms §1.A). One key shared across all installs conflicts with that.
- A single shared key is a single point of failure. Revocation breaks every install.
- Only a Tunarr-hosted proxy could keep a key secret. That's out of scope. It costs hosting, and the proxy becomes the shared target for abuse.

### TVDB exception (to confirm)

- TVDB offers a "subscriber-supported API key that requires that each of your users has a $12/year TheTVDB subscription" (v4-api README).
- Under that model Tunarr registers one project key and each user enters their own PIN. The project key alone shouldn't grant access, so shipping it would be safe.
- The README doesn't say this outright. Confirm with TVDB before relying on it.
- Fallback is a key the user registers. The free tier covers projects under $50k/year revenue and requires attribution, but nothing says TVDB approves personal keys.

### Storage

- Add a `metadataProviders` section to `SettingsSchema` in `server/src/db/SettingsDB.ts`. Fields are `tmdb.accessToken`, `tvdb.apiKey`, and `tvdb.pin`.
- Protect them like media source tokens (`MediaSource.accessToken`). Both are plaintext at rest today.
- Redact them in logs through `server/src/external/Redacter.ts`.
- The settings API never returns them. It returns `hasCredential: boolean` instead.

## Data model

New Drizzle tables. Generate the migration with `pnpm drizzle-kit generate`.

### `network`

| Column          | Type           | Notes      |
| --------------- | -------------- | ---------- |
| `uuid`          | text PK        |            |
| `name`          | text           | e.g. `HBO` |
| `originCountry` | text, nullable |            |

### `network_external_id`

| Column        | Type                | Notes                                |
| ------------- | ------------------- | ------------------------------------ |
| `networkId`   | text FK → `network` | Cascade delete                       |
| `sourceType`  | text                | `tmdb` or `tvdb`                     |
| `externalKey` | text                | The provider's network or company ID |

- Unique on (`sourceType`, `externalKey`).
- One `network` row can carry IDs from both providers.
- Matching an incoming network: first by external ID, then by exact `name` and `originCountry`, else create a row. Country keeps ABC (US) apart from ABC (Australia).

### `network_grouping`

| Column       | Type                         | Notes                                |
| ------------ | ---------------------------- | ------------------------------------ |
| `networkId`  | text FK → `network`          | Cascade delete                       |
| `groupId`    | text FK → `program_grouping` | Show groupings only, cascade delete  |
| `sourceType` | text                         | The provider that reported this link |

- Primary key on (`networkId`, `groupId`, `sourceType`).
- `sourceType` lets a lookup replace only its own provider's links, and lets credential removal delete one provider's data.

### `network_lookup`

One row per show and provider. It drives refresh and records why a show has no networks.

| Column       | Type                         | Notes                                      |
| ------------ | ---------------------------- | ------------------------------------------ |
| `groupId`    | text FK → `program_grouping` |                                            |
| `provider`   | text                         |                                            |
| `status`     | text                         | `found`, `not_found`, `no_ids`, or `error` |
| `lookedUpAt` | integer                      | Epoch ms                                   |

## Studio provenance

Studios get external IDs too, so each studio records which sources reported it.

### Today

- `upsertProgramStudiosInternal` (`server/src/db/program/ProgramMetadataRepository.ts:155`) matches studios by name. One `studio` row is shared across all sources.
- `studio_entity` links have no source column. Each scan deletes and rewrites an entity's links.
- Jellyfin sends `Studios` as `{ Name, Id }` with a GUID `Id` (`types/src/jellyfin/index.ts:446`). Emby sends a numeric `Id` (`types/src/emby/index.ts:447`). Both canonicalizers keep only `Name` (`JellyfinApiClient.ts:1402`, `EmbyApiClient.ts:1221`).
- Plex (`studio`, `parentStudio`) and NFO (`<studio>`) send names only.

### `studio_external_id`

| Column          | Type                               | Notes                                                                                      |
| --------------- | ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `studioId`      | text FK → `studio`                 | Cascade delete                                                                             |
| `sourceType`    | text                               | `jellyfin`, `emby`, `plex`, `local`, `tmdb`, or `tvdb`                                     |
| `mediaSourceId` | text FK → `media_source`, nullable | Set for Jellyfin, Emby, Plex, and local. Jellyfin and Emby IDs are only unique per server. |
| `externalKey`   | text, nullable                     | Jellyfin GUID or Emby ID. Null for name-only sources.                                      |

- Unique on (`sourceType`, `mediaSourceId`, `externalKey`), with nulls treated as values.
- Name matching stays as it is. A Plex "HBO" and a Jellyfin "HBO" share one `studio` row with two external ID rows.
- A name-only row still records which media source reported the studio.
- Canonicalizers keep the Jellyfin and Emby `Id`, and `NewStudio` gains an optional `externalKey`.
- Studios stay out of the network lookup. TMDB `production_companies` and TVDB `companies.studio` could feed this table later.

## External IDs we already have

| Source   | Show IDs                                       | Where                                                         |
| -------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Jellyfin | `ProviderIds` → `tmdb`, `tvdb`, `imdb`         | `server/src/external/jellyfin/JellyfinApiClient.ts:2004-2021` |
| Emby     | Same                                           | `server/src/external/emby/EmbyApiClient.ts:2031`              |
| Plex     | `Guid` → parsed by `parsePlexGuid`             | `server/src/util/externalIds.ts:7`                            |
| Local    | None. `tvShowNfoToShow` sets `identifiers: []` | `server/src/services/scanner/LocalTvShowScanner.ts:738-746`   |

- The `TvShowNfo` schema already parses `uniqueid` (`server/src/nfo/NfoSchemas.ts:115`), but the scanner drops it. Mapping it to `identifiers` is a prerequisite and a standalone fix.
- Shows with no IDs get `status = no_ids` and no lookup.

### Lookup order

- TMDB: `tmdb` ID first, then `/find` with `tvdb_id`, then `imdb_id`.
- TVDB: `tvdb` ID first, then `imdb` through `/search/remoteid`.

## Provider interface

```ts
interface ShowNetworkProvider {
  readonly name: 'tmdb' | 'tvdb';
  isConfigured(): boolean;
  lookup(ids: ShowExternalIds): Promise<Result<NetworkRef[] | null>>;
}
```

- Implementations go in `server/src/external/tmdb/` and `server/src/external/tvdb/`.
- `null` means the provider has no match. `Result` errors cover network, auth, and rate-limit failures.
- This interface is the boundary that moves out if the fetchers become plugins.

## Lookup task

- `NetworkLookupTask` in `server/src/tasks/`. Register it in `TasksModule.ts` and schedule it in `server/src/services/startup/ScheduleJobsStartupTask.ts`.
- Triggers:
  - a library scan finishes
  - the daily sweep runs
  - a credential is added or changed
  - the user clicks "Refresh networks"
- It selects shows with no `network_lookup` row for a configured provider, or a row older than 90 days. 90 days stays inside TMDB's 6-month cache limit.
- It queries every configured provider and stores the union of their networks.
- It runs at low concurrency and backs off on `429`.
- After writing, it reindexes the affected shows and their episodes in Meilisearch.
- Removing a credential stops lookups and offers to delete that provider's network data (TMDB Terms §1.D).

## Search

- Index `network` (all networks, deduped by name) on show documents.
- Index `grandparent.network` on episode documents.
- Follow the `studio` pattern in `server/src/services/MeilisearchService.ts`, with filterable attributes at `:147-171` and document mapping at `:992-1126`.
- Add `network` to the search DSL field list in `@tunarr/shared` and to the search UI field menu.
- Smart collections can then filter by network with no further work.

## UI

- Settings › Metadata providers: credential fields, a "Test" button, last-run status, and attribution.
- Show details: "Networks: Fox, Comedy Central", with the provider's attribution.
- About page: TMDB logo and notice, and TVDB attribution.
- Network Channel preset: facet on `network` instead of `studio`.
- Preset option "Use studio when a show has no network data". It defaults to on, so the preset works before a credential is set. Shows matched through the fallback are labeled as studio matches in the preview.

## Core vs plugin

|                  | Core                               | Opt-in plugin                                          |
| ---------------- | ---------------------------------- | ------------------------------------------------------ |
| Fetcher lives in | `server/src/external/`             | A plugin package                                       |
| Prerequisite     | None                               | A plugin system, not yet designed                      |
| Shared work      | Schema, settings, task, search, UI | Same                                                   |
| Cost             | Smaller, ships sooner              | Plugin host, loading, and an enrichment API come first |

Decision (11/08/2026): core. The shared work and both fetchers ship in core behind `ShowNetworkProvider`. The fetchers can move to plugins once a plugin system exists.

## Rollout

1. Map `tvshow.nfo` `uniqueid` to show identifiers. This is a standalone fix.
2. Add `studio_external_id` and keep Jellyfin and Emby studio IDs. This is independent of the lookup.
3. Add the schema, settings section, provider interface, TMDB provider, and lookup task.
4. Add the search fields, DSL field, and show details UI.
5. Add the TVDB provider, after its key model is confirmed.
6. Switch the Network Channel preset to `network`, with or after PR #1805.

## Testing

- Provider unit tests on recorded responses: TMDB Game of Thrones, a TMDB show with several networks, and a TVDB extended record.
- Task tests for stale-row selection, `429` backoff, the multi-provider union, and `no_ids` handling.
- A local scanner test showing that `tvshow.nfo` `uniqueid` reaches show identifiers.
- A search document mapping test for `network` and `grandparent.network`.
- Studio upsert tests: a Jellyfin and a Plex "HBO" share one `studio` row with two external ID rows, and a rescan doesn't duplicate them.
- Network matching tests: external ID match, name-and-country match, and ABC (US) vs ABC (Australia) staying apart.
- Docs: a metadata providers page under `docs/configure/`.

## Open questions

1. Will TVDB let an open-source project ship a subscriber-supported key? Ask TVDB support. This gates rollout step 5.

## Sources (read 11/08/2026)

- TVDB v4 OpenAPI spec: `github.com/thetvdb/v4-api`, `docs/swagger.yml`, covering `/login`, `/search/remoteid/{remoteId}`, `SeriesExtendedRecord`, and `Companies`
- TVDB v4 README (access models, subscriber key): `github.com/thetvdb/v4-api`
- TVDB pricing and attribution: https://thetvdb.com/api-information, https://thetvdb.com/api-information/signup, https://thetvdb.com/subscribe
- TMDB authentication, rate limits, TV details, find: https://developer.themoviedb.org/docs
- TMDB terms (10/20/2023): https://www.themoviedb.org/api-terms-of-use
