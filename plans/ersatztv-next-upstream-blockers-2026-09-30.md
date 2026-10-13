# ErsatzTV next — upstream blockers track

> **Status (10/13/2026):** The ship condition in §6 is met. Upstream built B2's retry and fallback duration (#322), B6 (#320) and B8 (#321) itself and released them in `v0.2.1`. Tunarr pins `v0.2.2` (`31658e23b`) and uses all three (`c87cdaecf`, `f157db68d`, `615a11b9e`). The B2 failure budget is still open upstream and is the only item left to file. It does not gate shipping. Next step is the §5 follow-ups that remain.

Offshoot of [`ersatztv-next-integration-2026-09-19.md`](ersatztv-next-integration-2026-09-19.md), called "the main plan" below. The main plan owns the Tunarr side. This plan owns everything that has to change in [ErsatzTV/next](https://github.com/ErsatzTV/next) before Tunarr can ship the backend.

- **Evidence** stays in main plan §15. Register IDs (B2, G5, C9, …) refer to its rows.
- **This plan** owns the order of work, how each item goes upstream, its status, and the Tunarr change each item unlocks.
- **Scope** covers the §12 ship gate and the blockers in main plan §14 tier 2. Tier 1 warm-ups, tier 3 contract work other than C9, and tier 4 parity stay in the main plan.

---

## 1. Upstream drift since the register

The register was verified against `next` at `ed95077` (09/16/2026). Upstream landed 27 commits by 09/30, almost all on the hardware pipeline, 9 more on 10/01 that rework copy mode and version every config file, and 28 more by 10/07 that cover process shutdown, gap filling, output frame rate and release tooling. 22 more landed by 10/13 (#313–#331), released as `v0.2.1` and `v0.2.2`.

| Item | At `ed95077`                    | Now (10/13/2026)                                                                                                        | Effect on Tunarr                                                                                                          |
| ---- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| G5   | VAAPI dropped without driver    | Fixed in `f2a981b` (#249). Issue #246 closed 09/23                                                                      | Done. Pin moved to `091e174` on 09/30, `EtvNextVaapi.ts` deleted, smoke trace shows `h264_vaapi` with neither field sent  |
| D2   | No `mpeg2video`, no `mp3`       | `mpeg2video` encoder added (#272). `mp3` still missing                                                                  | Done for `mpeg2video` at pin `091e174`. `mp3` still refused                                                               |
| A6   | Playlist version mismatch       | Fixed by #275 (`4ad282f`), which closes #213                                                                            | Done at pin `570d136`                                                                                                     |
| A9   | `linux-arm` tests never run     | `linux-arm` (arm32v7) dropped entirely (#257)                                                                           | None. `download-ersatztv-next.ts` never requested `linux-arm`                                                             |
| A2   | `read_dir` errors swallowed     | Possible overlap with open PR #217 ("name the operation and the path on every io failure")                              | Check #217 before filing A2                                                                                               |
| B3   | `develop` is the only release   | #309, #310: immutable develop builds. #312: `release.yml`. `v0.2.0` published 10/07, `v0.2.1` and `v0.2.2` on 10/13     | Done. `v0.2.2` pinned in `31658e23b`                                                                                      |
| B5   | Lavfi in-point ignored          | `Lavfi`, `Rtsp`, `Script` have no in/out-point fields at all, here or at `ed95077`                                      | Not a Tunarr blocker. Folds into C2                                                                                       |
| B6   | `video_filter.rs:228`, `:540`   | Done in #320 (`v0.2.1`). `filters.scale.flags`, channel schema `0.1.2`. Upstream's default is now `bicubic`             | Done in `f157db68d`. Tunarr always sends the flag                                                                         |
| B2   | One callback attempt            | Retry and `fallback.duration_seconds` done in #322 (`v0.2.1`), playout schema `0.0.6`. Matches D2–D6. No failure budget | Done in `c87cdaecf` with D4's values and a 30-second fallback. The failure budget is still open                           |
| B8   | Video-only source errors        | Done in #321 (`v0.2.1`). Silence replaces a missing audio stream for every source kind                                  | Done in `615a11b9e`. Tunarr's forced `anullsrc` is gone                                                                   |
| B7   | No DTS/TrueHD rewrite in copy   | Copy mode redone (#280, #281). Items whose codec is not in `copy_formats` transcode                                     | Resolved upstream at pin `570d136`. DTS and TrueHD are not on the default list, so they transcode to the profile's format |
| —    | Channel config unversioned      | #276 versions channel and lineup configs. A config without `version` 0.1.0 is rejected                                  | Done at pin `570d136`. The mapper emits `ChannelConfigVersion`, and `PlayoutVersion` is 0.0.5                             |
| —    | Version string is `0.1.0-<sha>` | Builds append the target as build metadata: `0.2.0-96aa6cb6-develop+linux-x64`                                          | Done in `dc4d74269`. The version check drops `+…` before comparing                                                        |
| —    | No output frame rate            | #300 adds `normalization.video.frame_rate` (`N` or `N/D`). Schema `0.1.1`                                               | Vendored at `dc4d74269`. `normalizeFrameRate` may now be mappable. See §5                                                 |
| A1   | `.heartbeat` self-reap hole     | Fixed in #323. `ersatztv-channel` counts idle time from ready when `.heartbeat` is absent                               | Done. Tunarr still touches `.heartbeat` before spawn, which stays correct                                                 |
| A2   | `read_dir` errors swallowed     | #217 merged but does not touch this loop. Still `while let Ok(Some(entry))`, now at `playout_loader.rs:72`              | Still open. A fix can use #217's `io_context` helper                                                                      |
| —    | Orphaned ffmpeg on SIGTERM      | #289–#293: the worker kills ffmpeg on SIGTERM and exits when its parent dies                                            | Tunarr's PID-file orphan reaping may be removable. See §5                                                                 |
| —    | Enums spelled as `enum`         | #325, #326 spell channel-config enums as `oneOf` string `const` branches                                                | Done in `31658e23b`. The generator renders them as `z.enum`                                                               |
| —    | Subtitle rendition              | #331 names it "Subtitles" with no `LANGUAGE` and `DEFAULT=NO`                                                           | Done in `b4706cc1d`. Tunarr drops the hardcoded English label and keeps `DEFAULT=YES`                                     |
| —    | Logging                         | #324 moves to `tracing`, adds a `channel{number=N}` span and `ETV_LOG_FORMAT=json`                                      | No change needed. The troubleshoot pipeline regex still matches                                                           |
| D1   | Copy breaks mid-GOP starts      | #282, #283 add keyframe-aware seeking. An item that starts between keyframes transcodes                                 | Codec passthrough with mid-item starts now works. D1's remaining gap is the container and playlist model                  |

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

| Step | Item | Form              | Why this position                                                                                          |
| ---- | ---- | ----------------- | ---------------------------------------------------------------------------------------------------------- |
| 1    | B3   | Done              | Upstream cut `v0.2.0` on 10/07, then `v0.2.1` and `v0.2.2` on 10/13                                        |
| 1    | B2   | Design issue      | Retry and fallback duration done upstream (#322). The issue shrinks to the failure budget (§3.2)           |
| 2    | B6   | Done              | Upstream built it (#320)                                                                                   |
| 3    | B8   | Done              | Upstream built it (#321)                                                                                   |
| 4    | B5   | Re-scoped         | Not a blocker. Fold into C2, and send the graphics in-point one-liner with any small PR                    |
| 5    | B7   | Resolved upstream | Copy mode (#280, #281) transcodes any codec not in `copy_formats`. Only the Tunarr follow-up in §5 remains |
| 6    | B2   | PR                | Failure budget only, after step 1's issue settles the shape                                                |
| 7    | C9   | Design issue      | Not a ship gate. Once it exists, Tunarr derives its validation from the binary instead of hardcoding it    |
| 8    | B3   | Done              | `v0.2.2` pinned in `31658e23b`                                                                             |

### 3.1 B3 — tagged releases

- **Done upstream.** Develop builds publish to `ErsatzTV/next-develop-builds` (#309, #310). Stable releases publish from `release.yml` on a `v*` tag (#312). `v0.2.0` is the first, published 10/07/2026.
- **Done.** `v0.2.1` (10/13) carries B2's retry, B6 and B8. Tunarr ships on `v0.2.2`.

### 3.2 B2 — callback retry and failure budget

Retry and the configurable fallback duration are done upstream (#322). Upstream also enforces D6 itself and stretches the fallback to at least `retry_budget_ms`. The issue now proposes only the failure budget, `fallback.max_consecutive_failures` (B2 plan, D7 and D8). Its §4 draft cites `v0.2.0` line numbers and needs re-verifying before filing.

Make the case without Tunarr. A backend that cannot tell "this item failed" from "this channel is dead" gives no other consumer an outage signal either. The full argument is in main plan §15.B, "B2 in full."

### 3.3 B6 — scaling algorithm

- **Done upstream** in #320. `filters.scale.flags` covers the main picture, graphics and image subtitles, with channel schema `0.1.2`.
- Upstream changed the default to `bicubic`, unlike our plan. That does not affect Tunarr, which always sends the flag.

### 3.4 B8 and B7 — audio

- **B8** is done upstream in #321. The worker plays silence in place of a missing audio stream.
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
| B3  | Tagged releases                       | Ask       | #309, #310, #312 | 🟢 done      | [plan](ersatztv-next-b3-tagged-releases-2026-09-30.md)         | `v0.2.2` pinned by tag and SHA-256 (`31658e23b`). Bundled worker off the pin is refused (`8b19291e5`) |
| B2  | Retry and fallback duration           | —         | #322             | 🟢 done      | [plan](ersatztv-next-b2-callback-failure-budget-2026-09-30.md) | None. Retry fields emitted in `c87cdaecf`                                                             |
| B2  | Failure budget                        | Issue, PR | —                | 🟡 grilled   | [plan](ersatztv-next-b2-callback-failure-budget-2026-09-30.md) | Resolver-silence watchdog, `EtvNextSession.ts:55` (5-minute grace)                                    |
| B6  | Scaling-algorithm field               | —         | #320             | 🟢 done      | [plan](ersatztv-next-b6-scaling-algorithm-2026-09-30.md)       | None. Flags emitted in `f157db68d`                                                                    |
| B8  | Silent audio for video-only sources   | —         | #321             | 🟢 done      | [plan](ersatztv-next-b8-silent-audio-2026-09-30.md)            | None. Forced `anullsrc` removed in `615a11b9e`                                                        |
| B5  | In/out points on every source variant | PR        | —                | 🔴 re-scoped | [plan](ersatztv-next-b5-in-out-points-2026-09-30.md)           | Mapper attaches in/out points only to `local` and `http` sources (`EtvNextPlayoutItemMapper.ts:229`)  |
| C9  | `--describe` capability handshake     | Issue     | —                | 🔴 planned   | [plan](ersatztv-next-c9-describe-handshake-2026-09-30.md)      | Hardcoded validation rules in the mapper                                                              |

---

## 5. Tunarr follow-up when a fix lands

Upstream fixes reach users only through a pin bump. Every bump moves the following together in one commit, because main plan §12 treats them as one unit:

- `server/package.json` `ersatztvNext` gets `releaseRepo`, `releaseTag`, `commit`, and per-target `sha256` from the release API `digest`
- the vendored schemas under `server/src/stream/etv/schema/`
- the generated Zod (`pnpm generate-etv-schemas`)
- the emitted playout and channel config version constants (`PlayoutVersion`, `ChannelConfigVersion`).

| ID  | Tunarr change once the pinned binary carries the fix                                                                                                                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B3  | Done 10/13. `v0.2.2` pinned in `31658e23b` (`v0.2.0` first in `a2bd35122`), and the resolver refuses a bundled worker off the pin in `8b19291e5`. Warns only under `ERSATZTV_NEXT_PATH`                                                                                                                                            |
| B2  | Retry done in `c87cdaecf`: `timeout_us` 20 s, `retry_budget_ms` 25000, `retry_backoff_ms` 250, `fallback.duration_seconds` 30. Once the failure budget lands, map `errorScreen: kill` to "budget expires, don't restart" and remove the resolver-silence watchdog. The resolver deadline (B2 plan §5.1) is still Tunarr's to build |
| B6  | Done in `f157db68d`. `filters.scale.flags` always comes from `ffmpegSettings.scalingAlgorithm`, and it is off the ignored-settings list                                                                                                                                                                                            |
| B8  | Done in `615a11b9e`. The forced `anullsrc` track is gone, because it also silenced files whose audio Tunarr's probe missed                                                                                                                                                                                                         |
| B5  | Re-scoped. Add a mapper test asserting no `lavfi` source carries in/out points                                                                                                                                                                                                                                                     |
| B7  | Lift the copy refusal. Map Tunarr's `copy` to `mode: "copy"` with a fallback `format` (`aac`, `h264`), drop loudness under copy because upstream rejects it, and keep `channels` set so a TrueHD 7.1 fallback to `ac3` gets 6 channels. Add mapper tests for all three. Plan together with D1                                      |
| G5  | Done 09/30. `EtvNextVaapi.ts` deleted, and the mapper passes an unset device and `system` driver through as unset                                                                                                                                                                                                                  |
| D2  | Done 09/30 for `mpeg2video`. The refusal lifted when the schemas were regenerated                                                                                                                                                                                                                                                  |
| —   | `frame_rate` is in the pinned schema. Decide whether `normalizeFrameRate` maps to it. Tunarr's setting is a boolean, so it needs a target rate. Until then the ignored-settings note stays (`EtvNextChannelConfigMapper.ts:208`)                                                                                                   |
| —   | The worker now kills ffmpeg on SIGTERM and exits when its parent dies (#289–#293). Check whether Tunarr's PID-file orphan reaping can go                                                                                                                                                                                           |

---

## 6. Done when

The first two conditions are met as of 10/13/2026. The rest of §5 and main plan §12 remain.

- A tagged upstream release contains B2, B6 and B8. B5 was re-scoped out (see its plan). B7 was resolved by upstream copy mode at `570d136`.
- Tunarr pins that release by SHA-256, and §5's follow-ups are done or deliberately declined.
- Main plan §12 is marked passed, and its status block points here for the record.
