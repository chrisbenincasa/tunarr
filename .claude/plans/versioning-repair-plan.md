# Versioning & Release Repair — Plan

Decision recorded 2026-08-24, revised same day after Phases 1 and 3 were built.
Written from `main`. Every claim below was verified by reading the repo; file:line
references are given so each can be re-checked.

**Status:** Phase 3 done (`faee0050`, branch `feat/pre-migration-snapshot`).
Phase 1 built as a pilot (`ed3bd9aa`, branch `ci/calver-release-pilot`), unmerged
and unpushed. Phases 2 and 4 not started.

## Decision

**CalVer for the app**, format `YYYY.M.PATCH` — `2026.8.0`, `2026.8.1`. Dev channel keeps
its prerelease suffix: `2026.8.0-dev.1`.

Conventional commits and commitlint stay. Auto-generated changelogs stay. What goes away
is the `feat → minor` mapping, and with it the incentive to bundle features into larger
releases to keep the numbers calm.

**The changelog lives in GitHub Releases only.** `CHANGELOG.md` is retired — it stops at
`1.1.3` (2026-01-20) while tags are at `v1.3.13`, because semantic-release deliberately
does not commit generated files back. Release notes are generated per release and posted
to the GitHub release body.

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

**All three components are always present.** `2026.8` is not an acceptable rendering of
the first release of a month; it breaks the Docker tag trigger, `type=semver`, and the
three-component regex above. This ruled out `node-calver` (v24), whose documented default
elides a zero minor/patch.

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

## Phase 1 — Replace the release tooling with a CalVer workflow

**Superseded revision.** This phase originally said to keep semantic-release and teach it
CalVer. That is no longer the plan. Under CalVer, semantic-release's entire value —
deriving the bump from commit types — is dead weight, and everything else it does is
either unused or actively unwanted here:

- The bump analysis is moot; the date and a tag count decide the version.
- `CHANGELOG.md` generation is unused (it stops at 1.1.3; nothing commits it back).
- npm publish is off.
- No branches match the configured maintenance pattern in `release.config.mjs`.

What remains is note generation and creating a GitHub release, which is ~30 lines of
workflow. Teaching semantic-release CalVer would have meant a third-party plugin or an
`@semantic-release/exec` shim computing `nextRelease.version` — new machinery to keep a
tool whose remaining job is a `gh release create`.

**Built (`ed3bd9aa`, branch `ci/calver-release-pilot`, unmerged):**

1. New `.github/workflows/release.yml`. Computes the version by scanning git tags:
   `YYYY.M` from the UTC date, patch from the count of existing stable tags in that month.
   Prereleases are excluded from the stable count; `dev` produces `-dev.N`. Refuses to
   reuse an existing tag. Notes come from `conventional-changelog-cli -p conventionalcommits`.
   `dry_run` defaults to true.
2. The release is created with `secrets.RELEASE_PLEASE_TOKEN`, **not** `GITHUB_TOKEN` —
   tags pushed by the default token do not trigger the Docker build workflow.
3. Deleted `.release-it.json`, `release-it.yml`, `release-please.yml`.
4. Release stays manual (`workflow_dispatch`). It is the one thing standing between a bad
   merge and a published Docker image, and CalVer removes the pressure to batch anyway.

**Verified before commit** against a fake tag set in a throwaway repo: `2026.8.2` with
prereleases present, `2026.8.2-dev.1` on `dev`, `2026.9.0` for an empty month, and
`2026.7.10` from `v2026.7.9` (the lexical-vs-numeric sort trap).

**Remaining:**

- `semantic-release.yml` and `release.config.mjs` stay until the new flow has cut one real
  release. Delete them after that, not before.
- The four release-it dev dependencies (`release-it`, `release-it-pnpm`,
  `@release-it/bumper`, `@release-it/conventional-changelog`) plus
  `should-semantic-release` are now unreferenced in `package.json`. Removing them is a
  separate, deliberate call.
- Decide what happens to `CHANGELOG.md`: delete it, or leave it frozen with a header
  pointing at GitHub Releases.

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
2. Have `release.yml` invoke `generate-openapi --apiVersion <computed version>` after the
   version step, then commit `docs/generated/tunarr-v<version>-openapi.json` plus the
   regenerated `openapi-specs.js` as part of the release. The version is already an output
   of that workflow, so there is nothing new to compute.
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

## Phase 3 — Rollback safety (independent of versioning, and worth more) — **DONE**

Shipped as `faee0050` on branch `feat/pre-migration-snapshot` (unmerged, unpushed).

This is the phase that actually addresses the user behaviour behind the whole discussion:
upgrade, hit a bug, roll back. No version number was ever going to fix it.

**State before the work:**

- `server/src/migration/DrizzleMigrator.ts` contained **zero** references to backup.
  Migrations ran in place against the live database.
- There was **no downgrade guard anywhere**. Nothing detected that the schema was written by
  a newer Tunarr than the running binary.
- The backup machinery already existed and was not wired to migration:
  `server/src/db/backup/SqliteDatabaseBackup.ts`, `ArchiveDatabaseBackup.ts`,
  `DatabaseBackupStrategy.ts`, and `BackupTask` bound in `TasksModule.ts:73-83`.

**What shipped:**

1. **Snapshot before migrating.** `DBAccess.snapshotBeforeMigration` writes
   `db-pre-migration-<epoch>.bak` before any migration is applied. Rollback is now a
   one-line support answer: restore this file.
2. **Refuse to start on a newer schema.** `DrizzleMigrator.getUnknownAppliedMigrations()`
   compares the migrations table against the binary's known migrations; unknown entries
   raise `DatabaseSchemaTooNewError`, which names the offending migration and points at the
   `*-pre-migration-*.bak` file. The guard runs *before* the pending-migration check.
3. **Backup rotation split.** `bootstrap.ts` rotates two separate pools (keep last 3 each)
   so copy-migrator `.bak` files cannot evict the pre-migration snapshot.

Covered by `server/src/db/DBAccess.test.ts` (6 tests, all red-green proven).

---

## Phase 4 — State the contract

Only credible once Phase 3 exists (it now does); documentation alone will not stop anyone
rolling back.

- Tunarr is not backwards compatible across versions. Upgrades may migrate the database.
- Rollback is supported via the pre-migration snapshot, and the docs say where it is.
- The version number denotes *when*, not *what changed*. Read the release notes for that.
- Release notes live in GitHub Releases; there is no in-repo changelog.
- The API spec dropdown is a historical record, not a compatibility contract.

---

## Suggested order

| # | Phase | Status |
|---|---|---|
| 1 | Phase 3 — rollback safety | **Done** (`faee0050`), unmerged |
| 2 | Phase 1 — CalVer release workflow | **Piloted** (`ed3bd9aa`), unmerged, needs one real dry run in CI |
| 3 | Phase 2 — spec naming | Blocked on Phase 1 landing |
| 4 | Phase 4 — contract docs | Ready; Phase 3 is done |

## Open questions

1. Backfill the missing `1.3.9`–`1.3.13` specs, or start the record clean?
2. Does the first CalVer release get a `2.0.0`-style announcement, given the number jumps from
   `1.3.13` to `2026.8.0` and will look alarming in a Docker tag list?
3. Delete `CHANGELOG.md`, or freeze it with a pointer to GitHub Releases?
4. Drop the five now-unreferenced release dev dependencies from `package.json`?
