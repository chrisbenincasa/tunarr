# ErsatzTV next — B6 scaling algorithm

> **Status (09/30/2026):** Planned. Verified against upstream `091e174`. Nothing filed. Next step is the PR in §2. No issue first, because the default stays the same.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md).

## 1. Verified state at `091e174`

- `ScaleFilter::as_arg` hardcodes `flags=fast_bilinear` (`crates/ffpipeline/src/video_filter.rs:234`). The register cited `:228`.
- `SubtitleImageScaleFilter::as_arg` hardcodes the same flag (`:599`). The register cited `:540` and called it a second video scale site. It actually scales image subtitles.
- `ScaleFilter` is also built for watermark and canvas scaling (`pipeline.rs:785`, `:801`), so those inherit the flag.
- The accel modules replace `ScaleFilter` with their own hardware scalers (`accel/qsv.rs:36`, `accel/amf.rs:69`, and the cuda, vaapi, vulkan and videotoolbox modules). Hardware scaling never reads the flag.
- `VideoNormalizationConfig` (`crates/ersatztv-channel/src/config.rs:131`) has `scaling_mode` but no algorithm. `scaling_mode` reaches `OutputSettings` at `channel_session.rs:576`.
- Tunarr's `scalingAlgorithm` accepts `bicubic`, `fast_bilinear`, `lanczos` and `spline`, and defaults to `bicubic` (`types/src/schemas/settingsSchemas.ts:98`). Tunarr applies it only to software scaling too.

## 2. Upstream change

One PR, `feat: configurable software scaling algorithm`.

1. **Config.** Add `ScalingAlgorithm` to `config.rs` with `fast_bilinear` (default), `bilinear`, `bicubic`, `lanczos` and `spline`, serialized in lowercase snake case. Add `#[serde(default)] pub scaling_algorithm: ScalingAlgorithm` to `VideoNormalizationConfig`, plus a `From` impl beside the `ScalingMode` one (`:279`).
2. **Pipeline type.** Add a matching enum to `ffpipeline/src/output_settings.rs` with an `as_flag()` that returns the ffmpeg `-sws_flags` name. Add `scaling_algorithm` to `OutputSettings`.
3. **Filter.** Add an `algorithm` field to `ScaleFilter` and use it in `as_arg`. Set it from `final_output_settings` at `pipeline.rs:487`.
4. **Graphics scaling.** Pass the same setting at `pipeline.rs:785` and `:801`. Watermarks are small, so quality matters there as much as for the main picture.
5. **Image subtitles.** Add the field to `SubtitleImageScaleFilter` and pass the setting at `pipeline.rs:571`. Ask in the PR whether the maintainer would rather leave subtitles at `fast_bilinear`.
6. **Session.** Map the config at `channel_session.rs:576`.
7. **Accel modules.** They match `ScaleFilter { size, .. }`, so the new field needs no change there. Note in the PR that hardware scalers keep their own defaults.
8. **Schema.** Regenerate `schema/channel_config.json` with `gen_channel_config_schema`.

## 3. Tests

- Unit tests in `video_filter.rs` assert `as_arg` for each algorithm.
- Fix every test that constructs `ScaleFilter` or `OutputSettings` (`filter_chain.rs` tests, `qsv.rs:515`, `tests/common/mod.rs:749`). Default the field so the diff stays small.
- One `shared_tests!` case runs a 480p-to-1080p software scale with `bicubic` and asserts the segment decodes cleanly. Run it locally in the `test-runtime` image, because upstream CI runs only `codec_copy`.

## 4. Tunarr follow-up

| Change                                                                                 | Where                                    |
| -------------------------------------------------------------------------------------- | ---------------------------------------- |
| Map `ffmpegSettings.scalingAlgorithm` to `normalization.video.scaling_algorithm`.      | `EtvNextChannelConfigMapper.ts`          |
| Remove the ignored-setting note for `scalingAlgorithm` (`:216-221`) and its test case. | `EtvNextChannelConfigMapper.ts` and test |
| Remove the "Scaling algorithm" row from the ignored-settings table (`:49`).            | `docs/configure/ffmpeg/ersatztv-next.md` |
| Pin bump per blockers plan §5. The generated Zod gains the enum.                       | —                                        |

## 5. Done when

- A tagged upstream release reads `scaling_algorithm`.
- Tunarr maps its setting, and a channel set to `bicubic` emits `flags=bicubic` in the worker's ffmpeg command.
