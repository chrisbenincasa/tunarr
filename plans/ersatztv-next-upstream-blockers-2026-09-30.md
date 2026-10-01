# ErsatzTV next — upstream blockers track

> **Status (09/30/2026):** Drafted. Nothing filed yet under this plan. The ship gate (B3) and the five blockers B2, B5–B8 are open upstream. G5 is fixed upstream (#249). Next step is to open the B3 release conversation and the B2 design issue, then send the B6 PR.

Offshoot of [`ersatztv-next-integration-2026-09-19.md`](ersatztv-next-integration-2026-09-19.md), called "the main plan" below. The main plan owns the Tunarr side. This plan owns everything that has to change in [ErsatzTV/next](https://github.com/ErsatzTV/next) before Tunarr can ship the backend.

- **Evidence** stays in main plan §15. Register IDs (B2, G5, C9, …) refer to its rows.
- **This plan** owns the order of work, how each item goes upstream, its status, and the Tunarr change each item unlocks.
- **Scope** covers the §12 ship gate and the blockers in main plan §14 tier 2. Tier 1 warm-ups, tier 3 contract work other than C9, and tier 4 parity stay in the main plan.

---

## 1. Upstream drift since the register

The register was verified against `next` at `ed95077` (09/16/2026). Upstream has landed 27 commits since then, almost all on the hardware pipeline.

| Item | At `ed95077`                  | Now (09/30/2026)                                                                           | Effect on Tunarr                                                              |
| ---- | ----------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| G5   | VAAPI dropped without driver  | Fixed in `f2a981b` (#249). Issue #246 closed 09/23                                         | `EtvNextVaapi.ts` workaround can go once the pin moves past `f2a981b`         |
| D2   | No `mpeg2video`, no `mp3`     | `mpeg2video` encoder added (#272). `mp3` still missing                                     | The `mpeg2video` refusal lifts when the next pin bump regenerates the schemas |
| A6   | Playlist version mismatch     | Filed by another user as #213. Open                                                        | None. Comment on #213 rather than filing again                                |
| A9   | `linux-arm` tests never run   | `linux-arm` (arm32v7) dropped entirely (#257)                                              | None. `download-ersatztv-next.ts` never requested `linux-arm`                 |
| A2   | `read_dir` errors swallowed   | Possible overlap with open PR #217 ("name the operation and the path on every io failure") | Check #217 before filing A2                                                   |
| B3   | `develop` is the only release | Unchanged. `develop` is still the only release                                             | Still the gate                                                                |

**Re-verify every row before filing it.** The register's file:line citations point at `ed95077`. Check each one against upstream HEAD first, because upstream moves fast enough that a row can go stale in a week.

---

## 2. How we work upstream

- **The channel is already open.** Christian has 13 merged PRs upstream (#19–#111). Direct PRs get accepted.
- **The maintainer often fixes a clear issue himself.** jasongdove authors about 85% of upstream PRs. #246 was fixed by #249 two days after filing. A short, reproducible issue can therefore land faster than a PR.
- **Small, self-contained fixes go straight to a PR.** Open an issue only when the fix changes default behavior.
- **Schema changes go to an issue first.** Agree on the shape, then send the PR. Upstream's `AGENTS.md` names the JSON schemas as the public contract and legacy ErsatzTV as the primary integrator, so a schema change reaches more consumers than Tunarr.
- **One register item per PR.** Use conventional-commit titles (`fix:`, `feat:`) to match upstream history.
- **Tests go in the shared matrix.** Add cases to the `shared_tests!` macro (`crates/ffpipeline/tests/common/shared.rs`) so every accel suite runs them. Upstream CI runs only `codec_copy`, so run the integration suites locally in the `test-runtime` Docker image, which carries the ErsatzTV ffmpeg build.
- **Christian reviews and trims every issue before it is filed.** Keep issues short and in his voice, with a repro that needs no media files where possible.
- **Record every issue and PR in §4** when it is opened, and update its status when it lands.

---

## 3. Sequence

Start the two slow conversations on day one, then send the small PRs while those run.

| Step | Item | Form                    | Why this position                                                                                                       |
| ---- | ---- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1    | B3   | Issue or direct message | Longest lead time, and it gates shipping. It asks for a release habit, not code                                         |
| 1    | B2   | Design issue            | It adds config knobs and an exit-code contract, so the shape needs agreement. Pair it with B1's work-ahead knobs        |
| 2    | B6   | PR                      | The most visible regression, since every scaled frame degrades. Small: one config enum plus a format string             |
| 3    | B8   | PR                      | Small, because the `anullsrc` primitive already exists upstream. Video-only files fail on this backend today            |
| 4    | B5   | PR                      | Small. A lavfi item with an in-point silently seeks to zero                                                             |
| 5    | B7   | PR                      | Not reachable from Tunarr today, because the mapper refuses copy audio (main plan §9). Must land before copy is allowed |
| 6    | B2   | PR                      | After step 1's issue settles the shape                                                                                  |
| 7    | C9   | Design issue            | Not a ship gate. Once it exists, Tunarr derives its validation from the binary instead of hardcoding it                 |
| 8    | B3   | Pin bump                | After a tagged release contains steps 2–6. See §5                                                                       |

### 3.1 B3 — tagged releases

- **Ask** for version tags cut through the existing `artifacts.yml`. The asset-delete step already runs only when `release_tag == 'develop'`, so a tagged release keeps its assets with no pipeline change.
- **Offer** to cut a tag after each batch of Tunarr-relevant fixes, so the cadence costs the maintainer nothing extra.
- **Fallback** if tags don't come: mirror a SHA-256-verified `develop` asset into storage Tunarr controls (main plan §12). That works, but it makes Tunarr the release manager for someone else's binary.

### 3.2 B2 — callback retry and failure budget

The issue should propose:

- retry with backoff on a failed dynamic callback
- a configurable fallback quantum, replacing the hardcoded 60 seconds
- a failure budget, N consecutive failures or M seconds of continuous fallback, after which the worker exits non-zero.

Make the case without Tunarr. A backend that cannot tell "this item failed" from "this channel is dead" gives no other consumer an outage signal either. The full argument is in main plan §15.B, "B2 in full."

### 3.3 B6 — scaling algorithm

- Add a scaling-algorithm field to `VideoNormalizationConfig`, defaulting to today's `fast_bilinear` so existing configs keep their behavior.
- Replace the literal at both scale sites (`video_filter.rs:228`, `:540` at `ed95077`, which needs re-verifying).
- Regenerate `schema/channel_config.json` with `gen-channel-config-schema`.

### 3.4 B7 and B8 — audio

- **B8** synthesizes `anullsrc` when the selected source has no audio stream, instead of erroring to the fallback card.
- **B7** rewrites DTS and TrueHD to AC-3 when audio is otherwise copied. That needs a per-stream codec override in copy mode. Ask in the PR whether upstream wants this as a default or as a config switch.

---

## 4. Tracker

| ID  | Change                                | Form      | Upstream | Status        | Tunarr stopgap today                                                                                 |
| --- | ------------------------------------- | --------- | -------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| B3  | Tagged releases                       | Ask       | —        | open          | `server/package.json` `ersatztvNext` records drift but doesn't pin. Its own `note` says so           |
| B2  | Retry, backoff, failure budget        | Issue, PR | —        | open          | Resolver-silence watchdog, `EtvNextSession.ts:54` (5-minute grace)                                   |
| B6  | Scaling-algorithm field               | PR        | —        | open          | Compatibility notice lists `scalingAlgorithm` as ignored (`EtvNextChannelConfigMapper.ts:216`)       |
| B8  | Silent audio for video-only sources   | PR        | —        | open          | None for content items. `anullsrc` covers only error and flex items. Phase 5 adds the stopgap        |
| B5  | In/out points on every source variant | PR        | —        | open          | Mapper attaches in/out points only to `local` and `http` sources (`EtvNextPlayoutItemMapper.ts:208`) |
| B7  | DTS/TrueHD → AC-3 under copy          | PR        | —        | open          | Copy audio refused, because the generated `AudioFormatSchema` has no `copy` value                    |
| C9  | `--describe` capability handshake     | Issue     | —        | open          | Hardcoded validation rules in the mapper                                                             |
| G5  | VAAPI device and driver defaults      | Issue     | #246     | fixed in #249 | `EtvNextVaapi.ts` infers both                                                                        |

---

## 5. Tunarr follow-up when a fix lands

Upstream fixes reach users only through a pin bump. Every bump moves the following together in one commit, because main plan §12 treats them as one unit:

- `server/package.json` `ersatztvNext` gets the tag, commit, and per-target SHA-256
- the vendored schemas under `server/src/stream/etv/schema/`
- the generated Zod (`pnpm generate-etv-schemas`)
- the emitted playout schema version constant.

| ID  | Tunarr change once the pinned binary carries the fix                                                   |
| --- | ------------------------------------------------------------------------------------------------------ |
| B3  | Pin by tag plus SHA-256. Verify `--version` at startup and refuse the backend on mismatch              |
| B2  | Map `errorScreen: kill` to "budget expires, don't restart." Remove the resolver-silence watchdog       |
| B6  | Map `ffmpegSettings.scalingAlgorithm` to the new field. Drop it from the ignored-settings list         |
| B8  | Decide whether to keep Phase 5's `anullsrc` stopgap. It still guards against a probe that missed audio |
| B5  | None needed. Add a mapper test that pins the in-point on a lavfi item                                  |
| B7  | Lift the copy-audio refusal, together with D1 planning                                                 |
| G5  | Delete `EtvNextVaapi.ts` and its compatibility-notice branch                                           |
| D2  | Nothing by hand. The refusal reads the generated enum, so regenerating the schemas lifts it            |

---

## 6. Done when

- A tagged upstream release contains B2, B5, B6, B7 and B8.
- Tunarr pins that release by SHA-256, and §5's follow-ups are done or deliberately declined.
- Main plan §12 is marked passed, and its status block points here for the record.
