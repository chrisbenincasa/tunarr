# Versioning & Release Repair — Plan

Decision recorded 2026-08-24. **No repair work has been done.** Written from `main`,
clean tree. Every claim below was verified by reading the repo; file:line references
are given so each can be re-checked.

## Decision

**CalVer for the app**, format `YYYY.M.PATCH` — `2026.8.0`, `2026.8.1`. Dev channel keeps
its prerelease suffix: `2026.8.0-dev.1`.

Conventional commits and commitlint stay. Auto-generated changelogs stay. What goes away
is the `feat → minor` mapping, and with it the incentive to bundle features into larger
releases to keep the numbers calm.

**No separate API version.** The HTTP API has no path versioning (`/api/...`), so there is
no compatibility contract today. Introducing a second number would create an obligation
that would then need honoring. The docs version dropdown stays what it actually is: the
spec as of a given release.

### Why this format specifically

Zero-padding is forbidden — `2026.8.0`, never `2026.08.0` — for three concrete reasons:

1. `YYYY.M.P` without padding is **syntactically valid semver**, so
   `docker/metadata-action`'s `type=semver,pattern={{version}}`
   (`.github/workflows/build-and-push-docker.yml:72`) keeps working untouched.
2. `scripts/generate-docs-script.ts:6` matches each component with `(0|[1-9]\d*)`.
   `2026.08.0` would not match; `2026.8.0` does.
3. `semver.rcompare` (`generate-docs-script.ts:15`) then sorts releases correctly, and
   mixed `1.x` and `2026.x` entries sort chronologically because `2026.8.0 > 1.3.13`.

That last point matters beyond sorting: the jump from `v1.3.13` to `v2026.8.0` is
**monotonically increasing under semver comparison**, so nothing regresses — Docker
`latest` resolution, tag ordering and the docs dropdown all stay correct.

### Verified: nothing compares versions semantically at runtime

There is no update-checker and no `semver` usage in `server/src` outside the docs script.
`getTunarrVersion()` (`server/src/util/version.ts`) only ever produces and decorates a
string. So the scheme change carries no runtime behavioural risk.

---

## Current state

Four sources disagree:

| Source | Value |
|---|---|
| Git tags | `v1.3.13` |
| `package.json` | `1.2.0-dev.1` |
| Newest spec file in `docs/generated/` | `v1.3.8`, committed by hand (`edac4d9e`) |
| `docs/generated/openapi-specs.js` (drives the dropdown) | tops out at `1.2.0-dev.1`, no `1.3.x` at all |

`openapi-specs.js` references `tunarr-v1.2.0-dev.1-openapi.json`, which is **not tracked**
(`git ls-files` finds nothing). The published docs have a version option pointing at a 404.

**This is not a semantic-release defect.** semantic-release deliberately does not commit the
bump back; the tag is the source of truth and the in-repo `package.json` version is meant to
be inert. The defect is that the spec filename is derived from that inert file.

### Three release workflows, all manual

- `.github/workflows/release-it.yml` — "Release It (test)", `workflow_dispatch`
- `.github/workflows/release-please.yml` — `workflow_dispatch`
- `.github/workflows/semantic-release.yml` — "Semantic Release (test)", `workflow_dispatch`

Two configs are still checked in: `release.config.mjs` (semantic-release) and
`.release-it.json` (release-it + conventional-changelog + `@release-it/bumper`, which is what
used to keep `package.json` accurate). Nothing releases automatically; there are three
competing manual buttons.

---

## Phase 1 — Pick one release tool and delete the others

**Do this before anything else.** Every other repair depends on knowing which pipeline is
real.

semantic-release is the one to keep: it is already configured with the branch/channel model
this project uses (`release.config.mjs` — `main`, `dev` as a `dev`-channel prerelease,
maintenance branches).

1. Configure `@semantic-release/commit-analyzer` so `feat` no longer implies a minor bump.
   Under CalVer the bump is computed from the date, not the commit types.
2. Add CalVer computation. semantic-release has no native support; the options are a CalVer
   plugin or `@semantic-release/exec` computing `nextRelease.version` from the date plus the
   count of releases already made this month.
3. Delete `.release-it.json`, `release-it.yml`, `release-please.yml`, and the
   `release-please--*` branches.
4. Decide whether release stays a manual `workflow_dispatch` or becomes automatic on merge.
   **Recommendation: keep it manual.** It is the one thing standing between a bad merge and a
   published Docker image, and CalVer removes the pressure to batch regardless.

**Verify:** a dry run produces `2026.8.0` from a clean `main`, and a second dry run in the
same month produces `2026.8.1`.

**Risk:** the CalVer computation is the only genuinely new machinery here. Everything else is
deletion.

---

## Phase 2 — Make the spec name come from the release, not `package.json`

`GenerateOpenApiCommand.ts` already accepts an `apiVersion` argument
(`:35-38`, default `'latest'`) — and **only logs it** (`:41`). The filename it actually writes
comes from `getTunarrVersion()` (`:47-51`), which resolves
`TUNARR_BUILD` env var ?? `package.json.version` (`server/src/util/version.ts`).

So locally, and in any context without that env var set, every generated spec is stamped with
the stale `package.json` value. That is exactly how `tunarr-v1.2.0-dev.1-openapi.json` came to
be referenced by the docs index.

1. Use `args.apiVersion` for the output filename instead of `getTunarrVersion()`. Explicit
   beats ambient, and the argument already exists.
2. Have the release workflow invoke `generate-openapi --apiVersion <tag>` after the version is
   computed, then commit `docs/generated/tunarr-v<version>-openapi.json` plus the regenerated
   `openapi-specs.js` as part of the release.
3. Decide what `apiVersion=latest` should do when no version is passed — either refuse to
   write a versioned file at all, or write only `tunarr-latest-openapi.json`. Writing a
   version-stamped file from an unknown version is what created this mess.
4. Regenerate `openapi-specs.js` (`pnpm tsx scripts/generate-docs-script.ts`) so it stops
   referencing the untracked `1.2.0-dev.1` file.

**Open decision:** specs are missing for `1.3.9` through `1.3.13`. Either backfill them from
those tags or accept the gap and let the record start clean at the first CalVer release.

**Verify:** a release dry run writes `docs/generated/tunarr-v2026.8.0-openapi.json`, the
dropdown lists it, and every URL in `openapi-specs.js` resolves to a tracked file.

---

## Phase 3 — Rollback safety (independent of versioning, and worth more)

This is the phase that actually addresses the user behaviour behind the whole discussion:
upgrade, hit a bug, roll back. No version number was ever going to fix it.

**Verified state:**

- `server/src/migration/DrizzleMigrator.ts` contains **zero** references to backup.
  Migrations run in place against the live database.
- There is **no downgrade guard anywhere**. Nothing detects that the schema was written by a
  newer Tunarr than the running binary.
- The backup machinery already exists and is not wired to migration:
  `server/src/db/backup/SqliteDatabaseBackup.ts`, `ArchiveDatabaseBackup.ts`,
  `DatabaseBackupStrategy.ts`, and `BackupTask` bound in `TasksModule.ts:73-83`. Today it is
  only a scheduled task the user has to configure.

**Work:**

1. **Snapshot before migrating.** Have `DrizzleMigrator` call the existing backup code before
   applying anything, writing a copy stamped with the pre-migration schema state. Rollback
   becomes a one-line support answer: restore this file.
2. **Refuse to start on a newer schema.** If the migrations table contains entries the binary
   does not know about, exit with a message naming the snapshot rather than running against a
   schema it cannot read. Loud and specific beats mysterious.

**Verify:** migrate a DB forward, run the previous binary against it, and confirm it exits with
a message naming a snapshot that exists.

**Note:** this phase is independent of Phases 1 and 2 and could ship first. It is the highest
user-visible value in this document.

---

## Phase 4 — State the contract

Only credible once Phase 3 exists; documentation alone will not stop anyone rolling back.

- Tunarr is not backwards compatible across versions. Upgrades may migrate the database.
- Rollback is supported via the pre-migration snapshot, and the docs say where it is.
- The version number denotes *when*, not *what changed*. Read the release notes for that.
- The API spec dropdown is a historical record, not a compatibility contract.

---

## Suggested order

| # | Phase | Depends on |
|---|---|---|
| 1 | Phase 3 — rollback safety | Nothing. Highest user value, fully independent. |
| 2 | Phase 1 — one release tool | Nothing, but blocks Phase 2. |
| 3 | Phase 2 — spec naming | Phase 1, since the version must come from somewhere real. |
| 4 | Phase 4 — contract docs | Phase 3. |

## Open questions

1. Manual or automatic releases after consolidation? (Recommendation above: manual.)
2. Backfill the missing `1.3.9`–`1.3.13` specs, or start the record clean?
3. Does the first CalVer release get a `2.0.0`-style announcement, given the number jumps from
   `1.3.13` to `2026.8.0` and will look alarming in a Docker tag list?
