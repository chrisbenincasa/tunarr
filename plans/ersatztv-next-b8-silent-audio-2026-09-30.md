# ErsatzTV next — B8 silent audio for video-only sources

> **Status (10/01/2026):** Planned. Re-verified against upstream `570d136`. Video-only sources still fail. Upstream copy mode already handles the synthetic track (step 4 is done), so the PR is smaller. Nothing filed. Next step is the PR in §2.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md).

## 1. Verified state at `570d136`

- `InputSettings::select_audio_stream` (`crates/ffpipeline/src/input.rs:81`) returns `FFPipelineError::AudioInputIsRequired` (`:112`) when the probe finds no audio stream.
- `Pipeline` calls it at `pipeline.rs:379`. The error fails the item, and the session plays the fallback card until the item's `finish`. A silent film blacks out for its whole slot.
- The fallback item already builds silent audio as a separate `Lavfi` track with `anullsrc=channel_layout=stereo:sample_rate=48000` and a `pcm_s16le` probe hint (`channel_session.rs:1645`). Audio and video can come from different inputs.
- The audio chain always carries `apad` (`AudioFilter::Pad`), so a synthesized track lasts as long as the video.
- The audio copy decision (`copy_decision.rs`, #280) runs after the audio stream is selected. A `Lavfi` input always gets a `GeneratedSource` blocker, so a synthesized track transcodes even when the channel is in copy mode.
- Upstream has no session-level tests. The test matrix lives in `crates/ffpipeline/tests`, and `shared_tests!` runs every case on every accel.
- No fixture is video-only. Every `.ts` fixture carries audio.

## 2. Upstream change

One PR, `fix: synthesize silence when the source has no audio`.

The fix goes in `ffpipeline`, not the session. That keeps it inside the shared test matrix, and every consumer of `ffpipeline` gets it.

1. At the top of pipeline construction, before `select_audio_stream`, check whether the audio input's probe has any audio stream.
2. If it has none, replace `input_settings.audio_input` with a synthetic `ProbedInput`:
   - `input_source`: `InputSource::Lavfi` with `anullsrc=channel_layout=stereo:sample_rate=48000`
   - `probe_result`: one `pcm_s16le` stereo audio stream at index 0
   - `in_point`: zero
   - `out_point`: the video input's duration.
3. Log one `info` line that names the source and says silence was substituted.
4. **Copy mode.** Done upstream. The `GeneratedSource` blocker transcodes a `Lavfi` track, and `pcm_s16le` is not in `copy_formats` either. Substitute before the copy decision runs, and the rule applies with no extra code.
5. Keep `AudioInputIsRequired` for the one case that still deserves it, which is an audio track the playout explicitly selected by `stream_index` but which doesn't exist. Ask in the PR whether the maintainer wants that to fall back to silence as well.

## 3. Tests

- New fixture `480p_h264_video_only.ts`, generated with `ffmpeg -f lavfi -i testsrc2=size=854x480:rate=30 -t 5 -c:v libx264 -an`. Commit the command beside it.
- A `shared_tests!` case transcodes the fixture and asserts one AAC audio stream whose duration matches the video within one frame.
- A second case uses audio `mode: copy` and asserts AAC audio. That pins step 4 against a later change to the copy rules.
- A unit test on the substitution function, so the logic is covered when the integration suites don't run.
- Run the accel suites locally in the `test-runtime` image.

## 4. Tunarr follow-up

| Change                                                                                                                                                                                                                                                   | Where                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Phase 5 plans a stopgap that emits a separate `anullsrc` audio track when Tunarr's probe shows no audio. It is not built yet. If B8 lands first, drop it from Phase 5. If Phase 5 lands first, keep it only if it also guards a probe that missed audio. | main plan §11, `EtvNextPlayoutItemMapper.ts` |
| If the stopgap is never built or is removed, add a mapper test asserting that a video-only program gets no forced audio track.                                                                                                                           | `EtvNextPlayoutItemMapper.test.ts`           |
| Pin bump per blockers plan §5.                                                                                                                                                                                                                           | —                                            |

## 5. Done when

- A tagged upstream release plays a video-only file with silent audio on every accel.
- Tunarr has decided on the stopgap and recorded why.
