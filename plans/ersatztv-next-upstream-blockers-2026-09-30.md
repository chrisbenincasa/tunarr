# ErsatzTV next — upstream blockers track

> **Status (10/07/2026):** B3 is done. Upstream published `v0.2.0`, and Tunarr pins it by tag and per-target SHA-256 (`a2bd35122`) and refuses a bundled worker off the pin (`8b19291e5`). B6 now bumps the channel schema to `0.1.2`, because #300 took `0.1.1`. B2 and B6 are grilled and ready to file. B8 and C9 are planned but not grilled. Nothing is filed yet. Shipping waits on an upstream tag that contains B2, B6 and B8.

Offshoot of [`ersatztv-next-integration-2026-09-19.md`](ersatztv-next-integration-2026-09-19.md), called "the main plan" below. The main plan owns the Tunarr side. This plan owns everything that has to change in [ErsatzTV/next](https://github.com/ErsatzTV/next) before Tunarr can ship the backend.

- **Evidence** stays in main plan §15. Register IDs (B2, G5, C9, …) refer to its rows.
- **This plan** owns the order of work, how each item goes upstream, its status, and the Tunarr change each item unlocks.
- **Scope** covers the §12 ship gate and the blockers in main plan §14 tier 2. Tier 1 warm-ups, tier 3 contract work other than C9, and tier 4 parity stay in the main plan.

---

## 1. Upstream drift since the register

The register was verified against `next` at `ed95077` (09/16/2026). Upstream landed 27 commits by 09/30, almost all on the hardware pipeline, 9 more on 10/01 that rework copy mode and version every config file, and 28 more by 10/07 that cover process shutdown, gap filling, output frame rate and release tooling.

| Item | At `ed95077`                    | Now (10/07/2026)                                                                                         | Effect on Tunarr                                                                                                          |
| ---- | ------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| G5   | VAAPI dropped without driver    | Fixed in `f2a981b` (#249). Issue #246 closed 09/23                                                       | Done. Pin moved to `091e174` on 09/30, `EtvNextVaapi.ts` deleted, smoke trace shows `h264_vaapi` with neither field sent  |
| D2   | No `mpeg2video`, no `mp3`       | `mpeg2video` encoder added (#272). `mp3` still missing                                                   | Done for `mpeg2video` at pin `091e174`. `mp3` still refused                                                               |
| A6   | Playlist version mismatch       | Fixed by #275 (`4ad282f`), which closes #213                                                             | Done at pin `570d136`                                                                                                     |
| A9   | `linux-arm` tests never run     | `linux-arm` (arm32v7) dropped entirely (#257)                                                            | None. `download-ersatztv-next.ts` never requested `linux-arm`                                                             |
| A2   | `read_dir` errors swallowed     | Possible overlap with open PR #217 ("name the operation and the path on every io failure")               | Check #217 before filing A2                                                                                               |
| B3   | `develop` is the only release   | #309, #310: immutable develop builds. #312: `release.yml`. `v0.2.0` published 10/07 with all six targets | Done. `v0.2.0` pinned in `a2bd35122`                                                                                      |
| B5   | Lavfi in-point ignored          | `Lavfi`, `Rtsp`, `Script` have no in/out-point fields at all, here or at `ed95077`                       | Not a Tunarr blocker. Folds into C2                                                                                       |
| B6   | `video_filter.rs:228`, `:540`   | Now `:237` and `:642`. The second site scales image subtitles, not video                                 | The schema bump becomes `0.1.2`, because #300 took `0.1.1`                                                                |
| B7   | No DTS/TrueHD rewrite in copy   | Copy mode redone (#280, #281). Items whose codec is not in `copy_formats` transcode                      | Resolved upstream at pin `570d136`. DTS and TrueHD are not on the default list, so they transcode to the profile's format |
| —    | Channel config unversioned      | #276 versions channel and lineup configs. A config without `version` 0.1.0 is rejected                   | Done at pin `570d136`. The mapper emits `ChannelConfigVersion`, and `PlayoutVersion` is 0.0.5                             |
| —    | Version string is `0.1.0-<sha>` | Builds append the target as build metadata: `0.2.0-96aa6cb6-develop+linux-x64`                           | Done in `dc4d74269`. The version check drops `+…` before comparing                                                        |
| —    | No output frame rate            | #300 adds `normalization.video.frame_rate` (`N` or `N/D`). Schema `0.1.1`                                | Vendored at `dc4d74269`. `normalizeFrameRate` may now be mappable. See §5                                                 |
| A1   | `.heartbeat` self-reap hole     | #294 writes `.heartbeat` at ready, but only in the `ersatztv` server binary                              | Still open for Tunarr, which runs `ersatztv-channel` directly                                                             |
| A2   | `read_dir` errors swallowed     | Still `while let Ok(Some(entry))` at `playout_loader.rs:75`                                              | Still open                                                                                                                |
| —    | Orphaned ffmpeg on SIGTERM      | #289–#293: the worker kills ffmpeg on SIGTERM and exits when its parent dies                             | Tunarr's PID-file orphan reaping may be removable. See §5                                                                 |
| D1   | Copy breaks mid-GOP starts      | #282, #283 add keyframe-aware seeking. An item that starts between keyframes transcodes                  | Codec passthrough with mid-item starts now works. D1's remaining gap is the container and playlist model                  |

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

| Step | Item | Form              | Why this position                                                                                                |
| ---- | ---- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1    | B3   | Done              | Upstream cut `v0.2.0` on 10/07. Only the Tunarr pin move remains                                                 |
| 1    | B2   | Design issue      | It adds config knobs and an exit-code contract, so the shape needs agreement. Pair it with B1's work-ahead knobs |
| 2    | B6   | PR                | The most visible regression, since every scaled frame degrades. Small: one filter option plus a format string    |
| 3    | B8   | PR                | Small, because the `anullsrc` primitive already exists upstream. Video-only files fail on this backend today     |
| 4    | B5   | Re-scoped         | Not a blocker. Fold into C2, and send the graphics in-point one-liner with any small PR                          |
| 5    | B7   | Resolved upstream | Copy mode (#280, #281) transcodes any codec not in `copy_formats`. Only the Tunarr follow-up in §5 remains       |
| 6    | B2   | PR                | After step 1's issue settles the shape                                                                           |
| 7    | C9   | Design issue      | Not a ship gate. Once it exists, Tunarr derives its validation from the binary instead of hardcoding it          |
| 8    | B3   | Pin bump          | After a tagged release contains steps 2, 3, 5 and 6. See §5                                                      |

### 3.1 B3 — tagged releases

- **Done upstream.** Develop builds publish to `ErsatzTV/next-develop-builds` (#309, #310). Stable releases publish from `release.yml` on a `v*` tag (#312). `v0.2.0` is the first, published 10/07/2026.
- **Ask** for a new tag once B2, B6 and B8 are on `main`. That tag is the one Tunarr ships on.

### 3.2 B2 — callback retry and failure budget

Only retry gates shipping (B2 plan, D1 and D6). The issue should propose:

- retry with backoff on a failed dynamic callback
- a configurable fallback duration, replacing the hardcoded 60 seconds
- a failure budget, N consecutive failures or M seconds of continuous fallback, after which the worker exits non-zero.

Make the case without Tunarr. A backend that cannot tell "this item failed" from "this channel is dead" gives no other consumer an outage signal either. The full argument is in main plan §15.B, "B2 in full."

### 3.3 B6 — scaling algorithm

- Add `filters.scale.flags` to the channel config, following the #132 filter-options convention. Unset means today's `fast_bilinear`.
- Replace the literal at both scale sites (`video_filter.rs:237`, `:642` at `96aa6cb`).
- Bump the channel schema to `0.1.2`, regenerate `schema/channel_config.json`, and add a `CHANGELOG.md` entry. Details in the B6 plan.

### 3.4 B8 and B7 — audio

- **B8** synthesizes `anullsrc` when the selected source has no audio stream, instead of erroring to the fallback card.
- **B7** needs no upstream change. Since #280 and #281, copy mode copies an item only when its codec is in `copy_formats`. The default list is `aac`, `ac3`, `eac3` and `mp3`, so DTS and TrueHD transcode to the profile's format.

---

## 4. Tracker

- 🟢 Done upstream.
- 🟡 Not done upstream. Fully designed and grilled here, so it is ready to file.
- 🔴 Not done upstream, and not yet grilled here. A plan file may exist, but it has not been stress-tested.

| ID  | Change                                | Form      | Upstream         | Status       | Plan                                                           | Tunarr stopgap today                                                                                  |
| --- | ------------------------------------- | --------- | ---------------- | ------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| B7  | DTS/TrueHD → AC-3 under copy          | —         | #280, #281       | 🟢 done      | —                                                              | Copy audio refused. The mapper never emits `mode: "copy"`                                             |
| G5  | VAAPI device and driver defaults      | Issue     | #246             | 🟢 done      | —                                                              | None. Workaround deleted at pin `091e174`                                                             |
| B3  | Tagged releases                       | Ask       | #309, #310, #312 | 🟢 done      | [plan](ersatztv-next-b3-tagged-releases-2026-09-30.md)         | `v0.2.0` pinned by tag and SHA-256 (`a2bd35122`). Bundled worker off the pin is refused (`8b19291e5`) |
| B2  | Retry, backoff, failure budget        | Issue, PR | —                | 🟡 grilled   | [plan](ersatztv-next-b2-callback-failure-budget-2026-09-30.md) | Resolver-silence watchdog, `EtvNextSession.ts:54` (5-minute grace)                                    |
| B6  | Scaling-algorithm field               | PR        | —                | 🟡 grilled   | [plan](ersatztv-next-b6-scaling-algorithm-2026-09-30.md)       | Compatibility notice lists `scalingAlgorithm` as ignored (`EtvNextChannelConfigMapper.ts:216`)        |
| B8  | Silent audio for video-only sources   | PR        | —                | 🔴 planned   | [plan](ersatztv-next-b8-silent-audio-2026-09-30.md)            | None for content items. `anullsrc` covers only error and flex items. Phase 5 adds the stopgap         |
| B5  | In/out points on every source variant | PR        | —                | 🔴 re-scoped | [plan](ersatztv-next-b5-in-out-points-2026-09-30.md)           | Mapper attaches in/out points only to `local` and `http` sources (`EtvNextPlayoutItemMapper.ts:208`)  |
| C9  | `--describe` capability handshake     | Issue     | —                | 🔴 planned   | [plan](ersatztv-next-c9-describe-handshake-2026-09-30.md)      | Hardcoded validation rules in the mapper                                                              |

---

## 5. Tunarr follow-up when a fix lands

Upstream fixes reach users only through a pin bump. Every bump moves the following together in one commit, because main plan §12 treats them as one unit:

- `server/package.json` `ersatztvNext` gets `releaseRepo`, `releaseTag`, `commit`, and per-target `sha256` from the release API `digest`
- the vendored schemas under `server/src/stream/etv/schema/`
- the generated Zod (`pnpm generate-etv-schemas`)
- the emitted playout and channel config version constants (`PlayoutVersion`, `ChannelConfigVersion`).

| ID  | Tunarr change once the pinned binary carries the fix                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B3  | Done 10/07. `v0.2.0` pinned in `a2bd35122`, and the resolver refuses a bundled worker off the pin in `8b19291e5`. Warns only under `ERSATZTV_NEXT_PATH`                                                                                                                                       |
| B2  | Map `errorScreen: kill` to "budget expires, don't restart." Remove the resolver-silence watchdog                                                                                                                                                                                              |
| B6  | Always emit `filters.scale.flags` from `ffmpegSettings.scalingAlgorithm`. Drop it from the ignored-settings list                                                                                                                                                                              |
| B8  | Decide whether to keep Phase 5's `anullsrc` stopgap. It still guards against a probe that missed audio                                                                                                                                                                                        |
| B5  | Re-scoped. Add a mapper test asserting no `lavfi` source carries in/out points                                                                                                                                                                                                                |
| B7  | Lift the copy refusal. Map Tunarr's `copy` to `mode: "copy"` with a fallback `format` (`aac`, `h264`), drop loudness under copy because upstream rejects it, and keep `channels` set so a TrueHD 7.1 fallback to `ac3` gets 6 channels. Add mapper tests for all three. Plan together with D1 |
| G5  | Done 09/30. `EtvNextVaapi.ts` deleted, and the mapper passes an unset device and `system` driver through as unset                                                                                                                                                                             |
| D2  | Done 09/30 for `mpeg2video`. The refusal lifted when the schemas were regenerated                                                                                                                                                                                                             |
| —   | `frame_rate` is in the pinned schema. Decide whether `normalizeFrameRate` maps to it. Tunarr's setting is a boolean, so it needs a target rate. Until then the ignored-settings note stays (`EtvNextChannelConfigMapper.ts:214`)                                                              |
| —   | The worker now kills ffmpeg on SIGTERM and exits when its parent dies (#289–#293). Check whether Tunarr's PID-file orphan reaping can go                                                                                                                                                      |

---

## 6. Done when

- A tagged upstream release contains B2, B6 and B8. B5 was re-scoped out (see its plan). B7 was resolved by upstream copy mode at `570d136`.
- Tunarr pins that release by SHA-256, and §5's follow-ups are done or deliberately declined.
- Main plan §12 is marked passed, and its status block points here for the record.
