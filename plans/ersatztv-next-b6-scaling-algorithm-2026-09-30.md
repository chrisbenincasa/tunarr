# ErsatzTV next — B6 scaling algorithm

> **Status (10/07/2026):** Planned and grilled. Re-verified against upstream `96aa6cb`. Upstream took channel schema `0.1.1` for `frame_rate` (#300), so this change bumps to `0.1.2`. PRs now need a `CHANGELOG.md` entry. The field follows the `filters` convention from #132, not a new typed enum. Nothing filed. Next step is the PR in §3. No issue first, because the default stays the same.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md).

## 1. Verified state at `96aa6cb`

- `ScaleFilter::as_arg` hardcodes `flags=fast_bilinear` (`crates/ffpipeline/src/video_filter.rs:237`). `ScaleFilter::evaluate` (`:190`) rebuilds the filter, so a new field must be carried there.
- `SubtitleImageScaleFilter::as_arg` hardcodes the same flag (`:642`). It scales PGS and DVD subtitle bitmaps.
- `pipeline.rs` builds `ScaleFilter` for the main picture (`:599`), the full-frame canvas (`:895`) and watermarks (`:911`). It builds `SubtitleImageScaleFilter` at `:687`.
- A test at `pipeline.rs:1728` asserts `flags=fast_bilinear` on the subtitle scale.
- Hardware scalers usually replace `ScaleFilter` and ignore its flags. QSV falls back to software `ScaleFilter` when the frame has alpha or ffmpeg lacks `vpp_qsv` (`accel/qsv.rs:37`). AMF falls back when `vpp_amf` is missing (cited at `accel/amf.rs:70` on `570d136`, not re-checked). In those cases the algorithm applies.
- Per-filter tuning lives in `normalization.video.filters` (`VideoFilterOptionsConfig`, `config.rs:229`, added in #132). Every option there is an `Option<String>` passed through to ffmpeg. It reaches the pipeline as `OutputSettings.filter_options` (`output_settings.rs:63`), mapped at `channel_session.rs:1833`.
- Channel config schema is `0.1.1` (`config.rs:13`, `compatible: 1`), bumped by #300 for `normalization.video.frame_rate`. Upstream's rule is that any schema change bumps `compatible` (`AGENTS.md:272`).
- A `compatible` bump makes the next release at least a feature release, and user-visible changes need a `CHANGELOG.md` entry under `## [Unreleased]` (`AGENTS.md` "Changelog").
- Tunarr's `scalingAlgorithm` accepts `bicubic`, `fast_bilinear`, `lanczos` and `spline`, and defaults to `bicubic` (`types/src/schemas/settingsSchemas.ts:98`). Tunarr's own pipeline applies it to the main picture only (`server/src/ffmpeg/builder/filter/ScaleFilter.ts:51-53`).

## 2. Decisions

| Question                    | Decision                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------- |
| Upstream default            | Stays `fast_bilinear`. Raise a `bicubic` default as a follow-up question in the PR, not here |
| Values                      | `fast_bilinear`, `bilinear`, `bicubic`, `lanczos`, `spline`. Documented, not typed           |
| Scope                       | One setting for main picture, canvas, watermarks and image subtitles                         |
| Config shape                | `normalization.video.filters.scale.flags: Option<String>`. `None` means `fast_bilinear`      |
| Tunarr emission             | Always send `scale.flags`, so `filters` is present on every channel                          |
| Tunarr ignored-setting note | Drop it. Docs say the setting affects software scaling only                                  |
| Integration test            | One case in the software suite only, not `shared_tests!`                                     |
| `examples/channel.json`     | Bump `version` only. Leave `filters.scale` out so new channels follow upstream's default     |

## 3. Upstream change

One PR, `feat: configurable software scaling algorithm`. Follows the `AGENTS.md` checklist for adding a channel config option (`:199-208`).

1. **Config.** Add `ScaleOptions { flags: Option<String> }` to `config.rs`, beside `YadifOptions` (`:292`), with `#[serde(deny_unknown_fields)]`. Add `pub scale: Option<ScaleOptions>` to `VideoFilterOptionsConfig`. The `///` doc comment lists the five values and says hardware scalers ignore it.
2. **Schema version.** Bump `SUPPORTED_SCHEMA.compatible` to 2 (`config.rs:13`), which makes the schema `0.1.2`. Bump `version` in `examples/channel.json`. If another change lands first, take the next free number.
3. **Pipeline options.** Add `scale` to `VideoFilterOptions` (`output_settings.rs:67`) and to the `From` impl (`config.rs:302`).
4. **Filters.** Add a `flags: Option<String>` field to `ScaleFilter` and `SubtitleImageScaleFilter`. `as_arg` writes `flags=` with the value, or `fast_bilinear` when unset. Carry the field through `ScaleFilter::evaluate` (`video_filter.rs:190`).
5. **Call sites.** Pass `filter_options.scale` at `pipeline.rs:599`, `:687`, `:895` and `:911`.
6. **Accel modules.** They match `ScaleFilter { size, .. }`, so they need no change.
7. **Generated schema.** Regenerate `schema/channel_config.json` with `gen_channel_config_schema`.
8. **Changelog.** Add an `### Added` entry under `## [Unreleased]` naming `normalization.video.filters.scale.flags` and schema `0.1.2`.
9. **PR description.**
   - Hardware scalers ignore the setting. When an accel module falls back to software scaling, the setting applies.
   - Ask whether the maintainer would rather keep subtitles at `fast_bilinear`. Our default position is one setting for everything.
   - Ask whether a `bicubic` default is wanted as a follow-up.
   - `examples/channel.json` leaves the field out on purpose.
   - Cross-repo follow-up: legacy's generated `ChannelConfig.cs` needs regenerating (`AGENTS.md:286-292`).
   - State that the software integration suite ran, and on which ffmpeg build.

## 4. Tests

- Unit tests in `video_filter.rs` assert `as_arg` for `ScaleFilter` and `SubtitleImageScaleFilter`, with flags unset and set.
- Replace the `pipeline.rs:1728` assertion with one that checks the configured flag reaches the subtitle scale.
- Fix every test that constructs `ScaleFilter` (`filter_chain.rs:991`, `:1094`, `:2120`, plus any under `tests/common/`). Default the field to `None` so the diff stays small.
- One case in `crates/ffpipeline/tests/software.rs`. It scales 480p to 1080p with `flags` set to `bicubic` and asserts the output decodes cleanly.
- Before opening, run `cargo test --package ffpipeline --test software -- --ignored --test-threads 1` in the `test-runtime` image (`AGENTS.md:82-84`), as the PR conventions require. CI runs only `software codec_copy`.

## 5. Tunarr follow-up

| Change                                                                                                                           | Where                                    |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Always emit `filters.scale.flags` from `ffmpegSettings.scalingAlgorithm`. Merge with the deinterlace entry                       | `EtvNextChannelConfigMapper.ts:326-356`  |
| Update tests expecting `filters` to be undefined when deinterlace is off (`:179`)                                                | `EtvNextChannelConfigMapper.test.ts`     |
| Remove the `scalingAlgorithm` ignored-setting note (`:216-221`) and its test case (`:240-246`)                                   | `EtvNextChannelConfigMapper.ts` and test |
| Replace the "Scaling algorithm" ignored row (`:48`) with a note: software scaling only, also covers graphics and image subtitles | `docs/configure/ffmpeg/ersatztv-next.md` |
| Pin bump per blockers plan §5. `ChannelConfigVersion` moves to `0.1.2`, and the generated Zod gains `scale`                      | —                                        |

## 6. Done when

- A tagged upstream release reads `filters.scale.flags`.
- Tunarr maps its setting, and a channel set to `bicubic` emits `flags=bicubic` in the worker's ffmpeg command.
