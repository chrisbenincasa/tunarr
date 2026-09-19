**Meilisearch upgrade: 1.30.0 → 1.53.x — 19 September 2026**

Tunarr pins Meilisearch **1.30.0** (`server/package.json` → `meilisearch.version`) and the JS client **0.50.0**. Upstream is at **1.53.2** (7 September 2026) and client **0.62.0**, so we are roughly 45 server releases and 12 client releases behind.

Most of what landed in that window is irrelevant to us: sharding and replication, AI embedders, conversational search, cross-index joins (`foreignKeys`), dynamic search rules, S3 snapshots, and several Enterprise-Edition-only features. The changes that do matter are a small set of indexing-memory fixes, filter fixes that touch the exact filter strings Tunarr builds, and **two hard blockers** that make a naive version bump fail.

This is a research plan written from upstream release notes and the GitHub release assets. Nothing was built, run, or upgraded — every "should" below is an expectation to verify, not an observation.

> **Status: proposal. No implementation work is authorized.**
>
> The recommended target is **1.53.1**, not 1.53.2, for the reason in §1.2. Confirm that before starting.

---

## 1. Blockers

### 1.1 The upgrade flag was renamed with no alias (1.51.0)

`--experimental-dumpless-upgrade` became `--upgrade-db` in [meilisearch#6486](https://github.com/meilisearch/meilisearch/pull/6486), which stabilized the feature. The diff removes the old option outright — it renames the `experimental_dumpless_upgrade` field to `upgrade_db` and rewrites the error strings — so there is no compatibility alias. The environment variable is now `MEILI_UPGRADE_DB`.

Tunarr passes the old flag unconditionally at `server/src/services/MeilisearchService.ts:472`. Any bump to 1.51 or later without changing that line will almost certainly fail at startup on an unknown-argument error.

This is the single required code change for the server bump.

### 1.2 1.53.2 ships no macOS Intel binary

The 1.53.2 release assets include `meilisearch-macos-apple-silicon` but **no `meilisearch-macos-amd64`** — only an `meilisearch-enterprise-macos-amd64`. Both 1.53.0 and 1.53.1 ship the community Intel build, as does every release checked back to 1.30.0.

`server/scripts/download-meilisearch.ts:153` maps `['darwin', 'x64']` to `macos/amd64`, so the download 404s on Intel Macs under 1.53.2. That breaks `pnpm install-meilisearch` and the macOS bundle path in `scripts/bundle-macos.sh`.

No upstream issue was found about it, so this may be a release-automation mistake that gets fixed. **Re-check the 1.53.2 assets before picking a target**; if the Intel build is still absent, pin 1.53.1.

### 1.3 Client ≥ 0.57 renames exports and drops CommonJS

Client 0.57.0 is ESM-only (CommonJS and UMD bundles dropped) and renames every `MeiliSearch` symbol to `Meilisearch` (lowercase `s`): `MeiliSearch` → `Meilisearch`, `MeiliSearchApiError` → `MeilisearchApiError`. Tunarr imports both at `server/src/services/MeilisearchService.ts:40`.

The server is already `"type": "module"` and esbuild bundles it to `dist/bundle.cjs`, so ESM-only input should be fine — but this is worth confirming against the bundle and the `@yao-pkg/pkg` executable rather than assuming. Client 0.51 also dropped Node 18, which does not affect us (we require Node 22).

**The server bump does not require a client bump.** Treat the client as a separate follow-up (§4).

---

## 2. What we actually gain

### 2.1 Indexing memory and speed

Tunarr exposes `maxIndexingMemory` and `--experimental-reduce-indexing-memory-usage` settings, which suggests memory pressure during scans is a real user-facing problem. This is the strongest argument for upgrading:

| Version | Change                                                                                          |
| ------- | ----------------------------------------------------------------------------------------------- |
| 1.39.0  | **Fixed a memory leak in the indexing pipeline present since ~1.12** — memory grew over time     |
| 1.40.0  | mimalloc v2 → v3; significantly lower memory on large workloads, shared with LMDB at link time   |
| 1.44.0  | Reduced allocation when computing prefixes                                                        |
| 1.32.0  | Document payloads extracted in parallel — ~7× on a 4M-document insert with 4 CPUs                |
| 1.41.0  | More efficient FST construction; no full scan of the word-docids DB, helps even small inserts    |
| 1.43.0  | Faster facet-search indexing — Tunarr uses `facetSearch`                                          |

`--experimental-reduce-indexing-memory-usage` still exists (1.44.0 explicitly recommends it), so `MeilisearchService.ts:525` stays as is.

### 2.2 Settings sync gets cheaper

`sync()` calls `updateSettings` with `filterableAttributes` / `sortableAttributes` on every startup (`MeilisearchService.ts:1941-1952`). Two changes help:

- **1.43.0–1.47.0**: filterable, sortable, and facet-search settings moved to the new settings indexer, which is faster and cancels cleanly.
- **1.52.0**: a settings task that changes nothing is skipped entirely, making our idempotent startup sync nearly free.

### 2.3 Filter fixes that touch our generated filters

`MeilisearchService.buildFilterExpression` emits `IN [...]`, `NOT IN [...]`, range (`a TO b`), and comparison filters, with `'` escaped as `\'` (`MeilisearchService.ts:1594`, `:1602`).

- **1.43.0** — string values in `<`, `<=`, `>`, `>=` and `IN` filters are now normalized before comparison, as `=` already was. Results for `IN` filters on string facets may shift slightly, and become consistent with equality. Worth a sanity check on library/media-source filters, which use base32-encoded case-sensitive ids.
- **1.50.0** — filters containing escaped characters (such as `\\`) no longer fail with `invalid_search_filter`. Plausibly affects titles with quotes or backslashes today; not reproduced.
- **1.50.0** — filter memory no longer grows quadratically with filter length. Relevant to `mediaSourceId NOT IN [...]` (`MeilisearchService.ts:1491`), which scales with the number of media sources.
- **1.46.0** — an incomplete filter returns an error instead of panicking internally.

### 2.4 New APIs worth adopting

- **`skipCreation`** (server 1.31.0, client 0.56.0) — `POST`/`PUT` documents ignore ids that are not already in the index instead of creating them. `updatePrograms` and `updateMovie` use `updateDocumentsInBatches` (`MeilisearchService.ts:755`, `:772`), which upserts; a partial update for a program already removed from the index leaves a half-populated stub document behind. This option prevents that. **Needs a client bump.**
- **`sort` on `getDocuments`** (client 0.55.0) — removes the cast and the TODO at `MeilisearchService.ts:1400-1404`, which currently works around the missing type via `as DocumentsQuery<...>`. **Needs a client bump.**
- **Partial facet wildcards** (1.50.0) — `facets` accepts patterns like `foo.*`, not just `*`. Nice to have, no current use.

---

## 3. Upgrade-path hazards

We rely on the in-place database upgrade, so the intermediate version we land on matters. Avoid these:

| Version         | Problem                                                                                                    | Resolution                        |
| --------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1.38.0 / 1.38.1 | Task processing could stop after automatic task-queue cleanup                                               | Fixed in 1.38.2                   |
| **1.45.0**      | Delete-by-filter auto-batched with document additions — **we delete by filter** (`state = "missing"`, `mediaSourceId NOT IN`, `:1479`, `:1491`) | Reverted 1.45.1, done right 1.46.0 |
| 1.48.0          | Dumpless-upgrade bug                                                                                        | Reverted in 1.48.1                |
| 1.49.0          | Upgrade failed migrating empty synonyms — we use no synonyms, so likely moot                                | Fixed in 1.50.0                   |

Two more notes on the 1.30 → 1.53 jump specifically:

- **The pre-1.32 field-id cleanup runs once.** Upgrading a database older than 1.32.0 triggers a cleanup step that took hours in 1.32 and was parallelized in 1.33.0 (reported 2h50m → under 7 minutes). Our data is 1.30, so this runs — expect a one-time startup delay on the first launch after the bump, and make sure the health-check retry in `start()` (`MeilisearchService.ts:597`) tolerates it. **This is the most likely user-visible upgrade symptom and the main thing to time in testing.**
- **1.41.0** now treats an empty `VERSION` file as missing. `getMeilisearchVersion()` (`MeilisearchService.ts:614`) reads that file directly and already handles a missing file; an empty one currently yields an empty string.

---

## 4. Proposed sequence

**Phase 1 — server bump (the whole point).**

1. Re-check whether 1.53.2 ships `meilisearch-macos-amd64`. If not, target **1.53.1**.
2. `server/package.json` → `meilisearch.version`.
3. `MeilisearchService.ts:472`: `--experimental-dumpless-upgrade` → `--upgrade-db`.
4. Verify (§5).

**Phase 2 — client bump, separate PR.** Move to client 0.62.x: rename the imports at `MeilisearchService.ts:40`, confirm the ESM-only package survives the esbuild bundle and the pkg executable, then drop the `getDocuments` cast (`:1400-1404`).

**Phase 3 — optional, once the client is current.** Adopt `skipCreation` on the partial-update paths so stale partial updates stop creating stub documents.

Phases 2 and 3 are independent of Phase 1 and carry no upgrade risk; Phase 1 should not wait on them.

---

## 5. Verification

The release notes cannot answer these; they need a real run.

- **In-place upgrade from a real 1.30 `data.ms`.** Time the first startup (§3, field-id cleanup) and confirm the service becomes healthy without the retry loop giving up.
- **Snapshot import.** `start()` passes `--import-snapshot` alongside the upgrade flag when the index folder is missing but a snapshot exists (`MeilisearchService.ts:481-486`). Whether importing a **1.30-era snapshot** into a 1.53 binary works, with or without `--upgrade-db`, is not covered by the release notes. Test it explicitly; it is the disaster-recovery path.
- **Filters.** Spot-check search, facet search, and the delete-by-filter paths — especially `IN` filters over base32-encoded case-sensitive ids, given the 1.43.0 normalization change.
- **All three platforms.** `pnpm install-meilisearch` on linux/amd64, linux/aarch64, macOS arm64, macOS x64, and Windows, plus the Docker symlink (`Dockerfile:120`) and `scripts/bundle-macos.sh`.

---

## 6. Explicitly not relevant

Recorded so the next person does not re-read the same notes:

- **Security fixes** — constant-time key comparison (1.34.0), SSRF via webhooks/embedders (1.34.1, 1.43.1), dump-import path traversal (1.33.1), and CVE-2026-57823 / CVE-2026-57824 on scoped API keys and tenant tokens (1.47.1, 1.48.2). All require API keys, remote configuration, or untrusted dumps. Tunarr runs Meilisearch on localhost with no master key and does not import third-party dumps.
- **Removed experimental flags** (1.51.0) — `--experimental-replication-parameters`, `--experimental-no-edition-2024-for-dumps`, `--experimental-no-snapshot-compaction`. We pass none of them.
- **Error-code renames** from the 1.47.0 search refactor — we only branch on HTTP 404 (`MeilisearchService.ts:689`).
- **Health-route changes** — 1.43.0 returns 500 after task-queue compaction (we never compact); 1.52.1 made health checks blocking.
- **`/tasks/stream` SSE** (1.52.0) — introduced, then reverted in 1.52.2. Our polling in `waitForTaskResult` stays.
- Sharding, networks, `useNetwork`, federated search, embedders, chat, dynamic search rules, `foreignKeys`, S3/IRSA snapshots, `/fields`, `showPerformanceDetails`, stats size reporting.

---

## 7. Sources

Upstream release notes for meilisearch 1.30.1 → 1.53.2 and meilisearch-js 0.51.0 → 0.62.0, read via the GitHub releases API on 15 September 2026, plus the release asset listings and the diff of [meilisearch#6486](https://github.com/meilisearch/meilisearch/pull/6486).

Tunarr code referenced: `server/package.json`, `server/src/services/MeilisearchService.ts`, `server/scripts/download-meilisearch.ts`, `Dockerfile`, `scripts/bundle-macos.sh`, at `db04cb69`.
