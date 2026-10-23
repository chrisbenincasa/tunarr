# Node.js major upgrade: 22 → 24 or 26

> **Status (10/23/2026):** Recommendation: Node 26 + better-sqlite3 13.0.3. Glibc 2.34 floor accepted by maintainer. Idle RSS of the pkg binary measured: +8% with the default worker pool, +12% without it. Next step is an implementation PR, plus stream-repro and an all-targets CI build on 26.

## Context

- Bundled runtime is 22.23.4 (PR #2369, October 2026 security release).
- Node 22 reaches end of life on 04/30/2027.
- Release binaries come from `@yao-pkg/pkg` 6.24.0 / pkg-fetch 3.6.7 (`server/scripts/make-bin.ts`). Docker runs the same binary.

## Recommendation

Move to **Node 26** with **better-sqlite3 13.0.3**.

- Longest support window (end of life 04/30/2029). LTS starts 10/28/2026.
- Runtime performance matches 24 and beats 22 by 7–23% on server workloads.
- Lower idle memory than 24 under the dev entry. The shipped binary uses 8% more than 22 at idle with the default worker pool.
- better-sqlite3 13.x uses N-API. One prebuilt binary per platform works on every Node version and ships inside the npm package, so `make-bin.ts` no longer needs the per-ABI GitHub download.
- Cost: the Linux standalone binary needs glibc 2.34, which drops Ubuntu 20.04 and Debian 11. Accepted by the maintainer on 10/23/2026.

Before shipping, run stream-repro and an all-targets CI build on 26 (see "Open questions").

## Support windows

Source: https://github.com/nodejs/Release

| Line | LTS start | Maintenance start | End of life |
|---|---|---|---|
| 22 | 10/29/2024 | 10/21/2025 | 04/30/2027 |
| 24 | 10/28/2025 | 10/20/2026 | 04/30/2028 |
| 26 | 10/28/2026 | 10/20/2027 | 04/30/2029 |

## Benchmarks

Setup:
- Intel i5-10400, 6C/12T, 62 GB RAM, Linux 6.8. Desktop under light background load.
- Node 22.23.4, 24.22.1, 26.12.1. All runs use better-sqlite3 12.11.1, so only Node differs.
- Dev entry (`node --import tsx src/index.ts`), not the pkg binary.
- Runs interleaved across versions. Treat differences under ~5% as noise.

Medians; percent is versus 22.

| Benchmark | 22 | 24 | 26 |
|---|---|---|---|
| Guide refresh, 40 channels / 14 days (ms, n=12) | 474.5 | 442.5 (−6.7%) | 438.0 (−7.7%) |
| Schedule save, worker pool off (ms, n=6) | 526 | 459 (−12.7%) | 476 (−9.6%) |
| Schedule save, worker pool on (ms, n=6) | 626 | 580 (−7.3%) | 524 (−16.3%) |
| Worst event-loop stall during save, pool off (ms, n=2) | 219 | 181 (−17.5%) | 181 (−17.3%) |
| Worker reply, 40k items, postMessage round trip (ms, n=6) | 79.9 | 64.3 (−19.5%) | 62.1 (−22.2%) |
| Worker reply, 40k items, structuredClone (ms, n=6) | 41.0 | 34.5 (−15.8%) | 31.6 (−22.9%) |
| Server vitest suite (s, n=5) | 59.2 | 56.6 (−4.4%) | 55.9 (−5.6%) |
| Cold start to first 200 (ms, n=7) | 8684 | 9342 (+7.6%) | 8838 (+1.8%) |
| RSS 10 s after ready (MB, n=7) | 225 | 482 (+114%) | 367 (+63%) |

Memory detail at 10 s (n=3):

| | 22 | 24 | 26 |
|---|---|---|---|
| V8 heap used (MB) | 107 | 124 | 90 |
| V8 heap total (MB) | 194 | 228 | 159 |
| RSS outside heap (MB) | ~131 | ~252 | ~209 |

- 22's RSS is bimodal (220 or 340 MB); it sometimes releases memory after boot. 24 and 26 stay flat.
- Most of the extra RSS on 24 and 26 sits outside the JS heap. The tsx loader may account for part of it.
- These dev-entry runs had the worker pool off. The pkg numbers below are what users run.
- No streaming or ffmpeg-path measurements.

### Shipped binary memory (pkg, linux-x64)

Same machine. Fresh temp DB per run, interleaved, main process RSS only (Meilisearch excluded). "Shipped 22" is the PR #2369 binary (better-sqlite3 11.8.1). The other two use better-sqlite3 12.11.1.

Worker pool on (default: `min(cores, 8)` = 8 workers here), n=5:

| | Shipped 22 | 22 | 26 |
|---|---|---|---|
| Ready (ms) | 5776 | 5811 | 6181 (+6%) |
| RSS at ready (MB) | 771 | 781 | 847 (+8%) |
| RSS +10 s (MB) | 1321 | 1319 | 1392 (+6%) |
| RSS +60 s (MB) | 1007 | 999 | 1081 (+8%) |

Worker pool off (`TUNARR_USE_WORKER_POOL=false`), n=3:

| | 22 | 26 |
|---|---|---|
| RSS at ready (MB) | 205 | 257 (+25%) |
| RSS +60 s (MB) | 171 | 191 (+12%) |

- The tsx +63% gap does not carry over to the shipped binary. The real cost of 26 is about 20 MB on the main thread and about 7 MB per worker.
- 952 of 1025 MB is anonymous memory, so the ~1 GB idle footprint is real allocation, not file pages from the 106 MB executable.
- The worker pool accounts for about 830 MB at idle, roughly 104 MB per worker, on either Node version. Each worker re-runs the full server bundle in its own V8 isolate. This is a cost on Node 22 today, independent of the upgrade.
- better-sqlite3 11.8.1 → 12.11.1 makes no measurable difference.

Raw data and scripts: `/tmp/claude-1000/-home-christian-Code-tunarr/c698932a-07f7-4d37-a115-86c5a07c4ccc/scratchpad/node-bench/` (local, ephemeral).

## Compatibility

### Tunarr code

- No calls to APIs removed or runtime-deprecated in 24, 25, or 26.
- Behavior changes to exercise:
  - `AsyncLocalStorage` (`server/src/ServerContext.ts:105`). Node 24 switched it to AsyncContextFrame.
  - Node 26 stream reads ("one buffer at a time", nodejs/node#60441). Run stream-repro on 26.
- New warnings:
  - `DEP0205 module.register()` on every dev start under 26, from tsx 4.20.6. Dev only.
  - `DEP0187` from `server/src/services/ArtworkService.ts:329` in tests, because the `ImageCache` mock returns null. Test only.

### better-sqlite3 (only native addon)

| Version | Node 22 | Node 24 | Node 26 | Linux glibc (measured, linux-x64) |
|---|---|---|---|---|
| 11.8.1 (current) | prebuild | no prebuild; source build works | source build fails (V8 API removals) | 2.29 |
| 12.11.1 | prebuild | prebuild | prebuild | 2.29 on 22/24, 2.34 on 26 |
| 13.0.3 (N-API) | bundled in npm package | same | same | 2.34 |

- 11.8.1 → 12.11.1 caused no type errors or test failures.
- 13.x publishes no GitHub release assets. Prebuilds sit at `prebuilds/<platform>-<arch>.node` in the tarball (darwin, linux, linuxmusl, win32 × x64, arm64).
- 12 → 13 API changes are unverified beyond the release notes (additive only).

### Build tooling

- pkg-fetch v3.6 has 24.22.1 and 26.12.1 for all six targets. pkg's Targets doc lists only node22 and node24, so 26 is undocumented there.
- `node-abi` 3.78.0 throws on 26.12.1. `make-bin.ts:129` calls it. Bump to ≥ 3.100, or drop the call with better-sqlite3 13.x.
- vitest 4.1.5 already declares `engines: >=24`. No installed package excludes 24 or 26.
- Corepack is not bundled in 25+. CI and Docker already install it with npm.

### Platform floors

| | 22 (today) | 24 | 26 |
|---|---|---|---|
| Linux glibc, whole binary | 2.29 | 2.29 (bs3 12.x) | 2.34 |
| macOS minimum | 11.0 | 13.5 | 13.5 |
| Windows | 10 / Server 2016 | same | same |
| Docker base (Ubuntu 24.04, glibc 2.39) | ok | ok | ok |

- glibc 2.34 drops Ubuntu 20.04 and Debian 11 for the standalone binary.
- macOS 13.5 drops Big Sur and Monterey on both 24 and 26.
- pkg-fetch's alpine (musl) floor on 26 is unverified.

## What we gain

- V8 12.4 → 14.6. Adds `using`, `RegExp.escape`, `Float16Array`, `Temporal`, `Map.getOrInsert`, faster `JSON.stringify` (V8 14.1).
- `URLPattern` as a global.
- SEA on 26 supports ESM entry points and `--build-sea`. That is a path off pkg-fetch's patched binaries if waiting on them becomes a problem again.
- Not a gain: native TypeScript stripping can't replace tsx (decorators, `@/` aliases, enums). `node:sqlite` is still not stable in 26. `require(esm)` is already on in 22.23.4. OpenSSL and TLS defaults are identical across all three.

## Implementation checklist

| File | Change |
|---|---|
| `server/scripts/make-bin.ts:24` | `NODE_VERSION` → 26.12.1 |
| `server/scripts/make-bin.ts:26-27, 126-133` | Drop the per-ABI better-sqlite3 download; copy the N-API prebuild from the package |
| `server/package.json` | `better-sqlite3` → 13.0.3; drop or bump `node-abi` |
| `server/scripts/bundle.ts:66` | esbuild `target` → `node26` |
| `package.json:41-42` | `engines.node` → `26` |
| `Dockerfile:6` | `NODE_MAJOR=26` |
| `.github/workflows/*.yml` | `node-version` → 26.12.1 |
| `@types/node` (root, server, shared, `pnpm-workspace.yaml`) | → 26.x |
| Docs | Update the Linux glibc and macOS minimums wherever install requirements are listed |

## Open questions

- Idle worker pool footprint (~830 MB with 8 workers) on every Node version. Separate from this upgrade. Options include a smaller default pool, lazy worker start, or a worker entry that loads only scheduling code. Not yet evaluated.
- Streaming on 26 (stream read change). Run stream-repro on an HLS and an MPEG-TS channel.
- All six targets build on 26, including macOS signing and alpine.

## Test hygiene found along the way

- `ArtworkService.test.ts > never redirects a credentialed URL...` sends a real request to `http://plex.local:32400` and times out when that host resolves on the LAN.
- `tests/perf/guideRebuildLag.test.ts` heap-ratio assertion failed 2/5 on Node 24 (misses by ~1%).
- The server suite leaves `/tmp/tunarr-artwork-*` directories behind.
- After `pnpm i` under a new Node major, pnpm can hardlink a native binary built for the old ABI from its store. Rebuild better-sqlite3 when switching versions locally.
