# Multiple Versions of One Program

> **Status (10/26/2026):** Investigation done, no code written. Version choice will be rule-based first, with overrides later. The schema allows many versions per program, but ingestion keeps one and version ids change on every scan. Next step is a per-source investigation of how to identify a version stably (see Open questions).

## Request

Several users want to keep more than one version of the same title, such as a 1080p and a 4K cut, or a theatrical and an extended edition. They also want to choose which version a channel plays. The source may be Plex, Jellyfin, Emby, or local files.

This is a different layer from #2192. That issue was about several video streams inside one file. This plan is about several files for one program.

## Current state

| Layer | What it does today | Where |
|---|---|---|
| Schema | `program` → many `program_version` → files, streams, chapters | `server/src/db/schema/ProgramVersion.ts`, `Program.ts:133` |
| Version identity | Random `uuid` only. No external key such as Plex Media id or Jellyfin MediaSource id | `ProgramVersion.ts` |
| Canonical model | A single `mediaItem` per program | `types/src/schemas/programmingSchema.ts:251` |
| Minting | Writes at most one version from `item.mediaItem` | `server/src/db/converters/ProgramMinter.ts:162` (`mintVersions`) |
| Plex ingest | Keeps the `Media` with the highest `id` and drops the rest | `server/src/external/plex/PlexApiClient.ts` (`plexMediaStreamsInject`, `maxBy(..., m => m.id)`) |
| Jellyfin/Emby ingest | Keeps the first `MediaSource` with `Protocol: 'File'`, else the first | `JellyfinApiClient.ts:1196` (`jellyfinApiMediaSourcesInjection`), Emby equivalent |
| Local ingest | Each video file becomes its own program, keyed by path | `server/src/services/scanner/LocalMovieScanner.ts:272` |
| Upsert | Deletes all of a program's versions and reinserts them with new uuids on every scan | `server/src/db/program/ProgramUpsertRepository.ts:195` (`upsertProgramVersions`) |
| Playback | Uses `head(program.versions)` with no ordering | `server/src/stream/ProgramStreamDetailsFetcher.ts:63` |
| Lineup | A content item stores the program `id` only | `server/src/db/derived_types/Lineup.ts` (`ContentLineupItemSchema`) |

### What this means

- The data model is about a third of the way there. The tables can hold N versions, but nothing writes more than one.
- A schedule cannot persist a version today. Any version uuid it saved would be gone after the next scan.
- Playback order is undefined once there is more than one version. `head()` on an unordered relation would pick arbitrarily.

## Proposed work

### 1. Stable version identity

- Requirement: a version keeps its identity across rescans, so rules and overrides can refer to it.
- Today `upsertProgramVersions` deletes and reinserts every version, which breaks any stored reference.
- The mechanism is undecided. Each source needs its own investigation before picking one approach that fits all of them (see Open questions).
- One candidate is an `externalKey` column, unique on `(programId, externalKey)`, with upsert by key. Possible keys:
  - Plex: `Media.id`
  - Jellyfin/Emby: `MediaSource.Id`
  - Local: file path

### 2. Ingest every version

- Canonical model: `mediaItems: MediaItem[]`. Keep `mediaItem` as the primary entry until callers move.
- Plex: emit every `Media` with a `Part`. Jellyfin/Emby: emit every `MediaSource`.
- `mintVersions` loops over `mediaItems`.
- Local stays one program per file. Grouping `Movie (2020) - 1080p.mkv` and `Movie (2020) - 2160p.mkv` into one program needs naming rules, which is a separate project.

### 3. Choose a version at playback

`ProgramStreamDetailsFetcher` resolves a version in this order.

1. An override, if one exists and still points at a version (later phase).
2. The version picked by the channel's rule.
3. A deterministic default. Today's ingest rule is the closest match: the highest Plex `Media.id`, or the first Jellyfin file source.

An override that no longer matches a version, because the file was removed, falls through to the next step and logs a warning.

### 4. UI

- Program details: list each version with resolution, codec, edition, and file.
- Stream selection profile editor: add the version rule.
- Later phase: an override picker wherever overrides live.
- Show the chosen version in the lineup editor.

## Decisions

### Rule-based selection first (10/26/2026)

- Add a version action to stream selection profiles (`types/src/schemas/streamSelectionSchema.ts`). Examples are "highest resolution ≤ 1080p" and "edition contains Extended".
- Profiles already choose audio and subtitle tracks per channel, so the plumbing exists.
- Users asking for this usually want a policy, not hundreds of manual picks.

### Overrides later

Overrides are likely needed but come after rules. Candidates:

| Option | How it works | Fits | Cost |
|---|---|---|---|
| Per program default | `program.preferredVersionId` | "Always play the 4K file" | Simple. One choice for every channel |
| Per lineup item | `ContentLineupItemSchema` gains a version reference | "This channel plays the extended cut" | The most UI. Slot and infinite schedules regenerate lineups, so the override must live on the schedule's content source, not only on the materialized item |

Both depend on stable version identity (step 1).

## Open questions

- **Version identity per source.** Investigate Plex, Jellyfin, Emby, and local separately. For each one, find out what identifies a version, whether that id survives server-side rescans and file replacement, and how an upgraded file (same title, new file) should be treated. Then choose one mechanism for all sources. External keys are one candidate, not a decision.
- **Target branch.** Scanning, canonical-model, and migration changes land in several PRs, which points at `dev`.
- **Slot schedules.** Classic slot schedules are being deprecated, so version choice goes into infinite schedules first. Any slot-scheduler change needs a row in `architecture/infinite-schedules/parity-checklist.md`.

## Related

- #2192 / PR #2383: picking the right video stream inside one file.
- No existing GitHub issue tracks this request.
