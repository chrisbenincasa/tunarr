# Media identity reconciliation

> **Status (11/08/2026):** Draft, **not grilled**. Nothing below is decided. Next step is a `/grill-with-docs` session on the open decisions. Tracks #1962 (bug) and #1121 (auto-match changed media).

## Problem

Tunarr keys every scanned item on an ID that its source can change. When the ID changes, the next scan treats the item as gone and creates a new program row. Everything that referenced the old row (channel lineups, custom shows, filler lists, slot schedules, play history) keeps pointing at a row marked `missing`.

| Source   | Item key Tunarr stores | Changes when                                                 |
| -------- | ---------------------- | ------------------------------------------------------------ |
| Plex     | `ratingKey`            | Reindex, re-match, delete and re-add, move between libraries |
| Jellyfin | Item `Id`              | Re-add, library rebuild; possibly a path move (unverified)   |
| Emby     | Item `Id`              | Re-add, library rebuild; possibly a path move (unverified)   |
| Local    | Full file path         | Any rename or move                                           |

Fixing one source is not enough. The fix is one reconciliation step that every scanner uses.

## Goals

- A rescan after a source ID change keeps the same program UUID, so every reference stays valid.
- One mechanism for all four sources, with source-specific matchers plugged in.
- Programs and groupings (shows, seasons, artists, albums) both covered.
- No false merges. An uncertain match creates a new row, as today.
- Every adoption is logged and visible to the user.

## Non-goals (v1)

- Migrating a channel from one media source to another (for example, Plex to Jellyfin). The matchers could support it later; see open decision 9.
- Content hashing of media files.
- Fixing scan error reporting, strict Plex parsing, or health checks. Those are separate issues split out of #1962.

## Current state

### What happens on a key change

1. Scanners load existing rows for the library keyed by source key (`getProgramInfoForMediaSourceLibrary`, then `existingPrograms[incoming.externalId]`).
2. The incoming item has an unknown key, so the scanner mints a new UUID and upserts. The upsert conflict target is `(source_type, media_source_id, external_key)`, so it inserts.
3. After the loop, rows whose key was not seen are set to `state = 'missing'` in the DB and the search index.
4. Nothing repoints references. The guide and streaming do not skip `missing` programs.

Missing detection scope differs by scanner:

| Scanner                                | Where missing is detected                                    |
| -------------------------------------- | ------------------------------------------------------------ |
| Remote movie, music video, other video | End of library scan                                          |
| Remote TV                              | Shows at end of library scan; seasons and episodes per show  |
| Remote music                           | Artists at end of library scan; albums and tracks per artist |
| Local scanners                         | Per scan, by path                                            |

Path-filtered (single-item) scans skip missing detection entirely.

### What references a program or grouping UUID

Keeping the old UUID is cheaper and safer than merging rows, because many tables cascade on delete.

- **FK to `program.uuid`, `onDelete: cascade`:** `channel_programs`, `channel_fallback`, `custom_show_content`, `filler_show_content`, `program_play_history`, `program_external_id`, `program_version`, `program_subtitles`, `artwork`, `credit`, `genre`, `studio`, `tag`, `external_collection` items
- **FK to `program_grouping.uuid`:** `program.tv_show_uuid`, `season_uuid`, `artist_uuid`, `album_uuid`, plus artwork, credits, genres, studios, tags, external collections, `program_grouping_external_id`
- **No FK:** lineup JSON files (`channel-lineups/<id>.json`) store program UUIDs and slot definitions with `showId`; infinite-schedule slots on `dev` reference groupings
- **Search index:** Meilisearch documents keyed by UUID

### Stable IDs each source already provides

| Source   | Native stable ID                                     | Provider IDs (IMDB, TMDB, TVDB) | Ingested via                  |
| -------- | ---------------------------------------------------- | ------------------------------- | ----------------------------- |
| Plex     | `plex-guid` (unmatched items get a key-derived guid) | Yes                             | `Guid` array, `parsePlexGuid` |
| Jellyfin | None known                                           | Yes                             | `ProviderIds`                 |
| Emby     | None known                                           | Yes                             | `ProviderIds`                 |
| Local    | None                                                 | Only with NFO `uniqueid`        | `mapNfoUniqueIds`             |

- Music has no provider ID type in `ProgramExternalIdType`. MusicBrainz IDs were declined in #575 (Plex guid space only).
- `program_external_id` has no index on `(source_type, external_key)`. Pairing in memory avoids needing one (see below).

### Gaps found during triage

- `649d4059c` (05/06/2026) removed a play-time fallback that re-resolved a Plex 404 by `plex-guid` and saved the new rating key. Nothing replaced it.
- The `program_external_id` upsert `SET` clause omits `external_key`, so an in-place key change needs its own write.
- The planned local fingerprint (#2208) hashes file name, mtime, and size. A rename changes it, so it cannot pair renamed files on its own.

## Proposed design

### Core idea

When an item disappears under one key and reappears under another, the existing row **adopts** the new key. The program UUID never changes, so no reference needs repair.

### Reconciliation step

A shared service, `IdentityReconciler`, runs inside each scanner at the point where missing detection happens today.

- **Inputs:**
  - **Vanished:** rows not seen in this scan scope (today's `missing` set).
  - **Arrivals:** incoming items with no existing row, deferred instead of inserted.
- **Process:**
  1. Run matchers in rank order over vanished and arrivals.
  2. Accept only one-to-one pairs at the first matcher that produces them.
  3. Adopt each pair. Insert unpaired arrivals as new rows. Mark unpaired vanished rows `missing`.
- **Output:** adoption records for logging and UI.

Deferring arrivals is what keeps UUIDs stable within one scan. Without deferral, the arrival is inserted first and the step becomes a merge.

### Matchers (ranked)

| Rank | Matcher                | Sources                                    | Guard                                                                          |
| ---- | ---------------------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| 1    | Native stable ID       | Plex (`plex-guid`, skip key-derived guids) | Same media source                                                              |
| 2    | Provider ID, same type | All                                        | Same program type; episodes also match show identity and season/episode number |
| 3    | Local file identity    | Local                                      | Same size and mtime, different path; same program type                         |
| 4    | Title match            | All                                        | Off by default; see open decision 6                                            |

- Matchers are a pluggable list, so a new source or ID type is one new matcher.
- A matcher returns candidate pairs. The reconciler, not the matcher, enforces one-to-one.

### Pairing rules

- One vanished row and one arrival match, and no other candidate shares the ID: adopt.
- Several candidates on either side: skip this matcher and try the next rank.
- No matcher pairs them: insert a new row and mark the old one `missing`, as today.
- Two editions of one movie share a guid and provider IDs. They are ambiguous and stay separate.

### Adoption write

One transaction per adoption:

- Update `program.external_key` (and `external_source_id` / `media_source_id` if it moved).
- Upsert `program_external_id` rows with the new key and paths, fixing the `SET` clause gap.
- Replace versions, media files, and streams with the arrival's, as a normal rescan would.
- Set `state = 'ok'`, update `canonical_id`.
- Update the search document in place.

### Groupings

- Shows, seasons, artists, and albums run through the same reconciler first, before their children.
- Children of an adopted grouping then resolve under the grouping's existing UUID.
- Slot `showId` references and smart collections keep working because the grouping UUID is unchanged.

### Visibility

- Log each adoption with old key, new key, and matcher.
- Record adoptions on the scan result so the UI can show "N items relinked".

## Edge cases

- **Single-item scans:** no missing detection, so no vanished set. Options in open decision 4.
- **Move between libraries:** the vanished row is in library A, the arrival in library B, scanned at different times. Needs a cross-scan path (open decision 3).
- **Key reused by the source:** a new item gets an old key. Today's flow updates the existing row in place with different content. `canonical_id` differs, so detection is possible. Out of scope unless grilling says otherwise.
- **Trash:** `missing` rows can be hard-deleted through trash (#1973), cascading through lineups. A row deleted before reconciliation is lost. Order relative to #1973 matters.
- **Partial scans:** a scan that fails midway must not mark rows missing, or reconciliation pairs against an incomplete arrival set.

## Open decisions

1. **Deferral vs. merge.** Defer arrivals within a scan (proposed), or insert immediately and merge after? Deferral keeps UUIDs; merge handles cross-scan cases.
2. **Merge semantics, if needed.** When a new row already exists, which UUID survives? Likely the old one, with the new row's references repointed and the new row deleted.
3. **Cross-scan pool.** Should arrivals also match against rows already `missing` from earlier scans (any library in the media source)? This covers library moves and staggered scans.
4. **Single-item scans.** Ask the source whether the old key still exists, or skip reconciliation for single-item scans?
5. **Episode guard.** Is show identity plus season and episode number enough alongside provider IDs, or require both?
6. **Title fallback.** Offer title matching (year for movies, S/E for episodes) as opt-in, or never? #1121 asked for it.
7. **Music.** Match tracks by artist, album, track number, and title, or add MusicBrainz IDs?
8. **Play-time fallback.** Restore a play-time recovery for Plex 404s as a safety net, or rely on scan-time only?
9. **Cross-source.** Allow a Plex row to adopt a Jellyfin arrival (source migration) later, or keep pairing within one media source permanently?
10. **Manual relink.** Provide a UI to pair a `missing` row with a new item by hand when matchers refuse?
11. **Existing duplicates.** Run a one-time repair task that pairs current `missing` rows with live duplicates on upgrade?

## Testing

- Unit tests for the reconciler: one-to-one, ambiguous, no match, rank fallthrough.
- Scanner tests per source with a fake client returning a rotated key for the same item:
  - same program UUID after rescan
  - lineup, custom show, and filler references intact
  - search document updated, not duplicated
- Grouping test: rotated show key keeps show UUID and slot `showId` references.
- Local test: renamed file with same size and mtime is adopted.
- Negative test: two editions with the same guid stay separate.

## Related work

- #1962: bug report (Plex rating key rotation)
- #1121: auto-match changed media
- #1973 / `plans/library-reconciliation-cascade-fix-plan.md`: trash and cascade deletion
- #2208 / `plans/local-scan-item-fingerprint.md`: local per-item fingerprint
- #2485: dead `plexStream` settings (split from #1962)
