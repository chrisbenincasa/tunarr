# ErsatzTV next — B7 DTS and TrueHD to AC-3 under copy

> **Status (09/30/2026):** Planned. Verified against upstream `091e174`. Nothing filed. Not reachable from Tunarr today, because the mapper refuses copy audio. Next step is the PR in §2, after B8 lands.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md).

## 1. Verified state at `091e174`

- Copy mode means `normalization.audio.format` is unset. `AudioFormat` (`config.rs:95`) has only `aac` and `ac3`, and no `copy` value.
- `pipeline.rs:342-346` maps an unset format to `AudioCodec::Copy`. The decision runs before `select_audio_stream` (`:349`), so it can't see the source codec.
- `optimize()` (`pipeline.rs:921-935`) strips bitrate, buffer, channels and sample rate under copy, and disables the audio filter chain.
- `next` selects one audio stream per item (`input.rs:75`). A per-stream override is therefore one decision, not a list. Tunarr's own version builds a list (`FfmpegStreamFactory.ts:695-713`), because Tunarr can map several audio streams.
- No fixture carries DTS or TrueHD.
- ffprobe reports these codecs as `dts` and `truehd`.

## 2. Upstream change

One PR, `fix: re-encode audio that Apple players can't decode under copy`.

1. Move the `audio_codec` decision after `select_audio_stream`. B8 already moves it after its substitution, so build on that.
2. Under copy, if the selected stream's codec is `dts` or `truehd`, choose `AudioCodec::Ac3`.
3. AC-3 carries at most 5.1. When the source has more than six channels, set the channel count to 6 for that item. TrueHD is often 7.1.
4. Because the codec is no longer `Copy`, `optimize()` keeps the audio filter chain and options. Check that a copy config carries no bitrate, so ffmpeg's AC-3 default applies. Set 640 kbps for 5.1 if the default proves too low.
5. Log one `info` line naming the source codec and the rewrite.
6. **Ask in the PR** whether the maintainer wants this as the default or behind a config switch, for example `normalization.audio.copy_rewrite`. The default protects Apple clients. A switch protects anyone who passes DTS to a receiver.

Keep the rule as a small function, `copy_compatible(codec) -> Option<AudioCodec>`, so B8's `pcm_s16le` case and any later codec (for example `flac` or `opus` in MPEG-TS) go in the same place.

## 3. Tests

- New fixtures `720p_h264_dts.ts` (5.1 DTS) and `720p_h264_truehd.mkv` (7.1 TrueHD), a few seconds each. ffmpeg needs `-strict -2` for both encoders. Commit the commands beside them.
- `shared_tests!` cases under copy mode assert AC-3 output, six channels for TrueHD 7.1, and clean decode.
- A unit test for `copy_compatible`.
- Confirm `codec_copy` still copies AAC untouched.

## 4. Tunarr follow-up

Tunarr refuses copy audio today (`EtvNextChannelConfigMapper.ts:129-135`), because the generated `AudioFormatSchema` has no `copy` value. B7 is the condition for lifting that refusal, but it is not the whole job.

| Change                                                                                           | Where                                    |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Accept Tunarr's copy audio format and map it to an unset `normalization.audio.format`.           | `EtvNextChannelConfigMapper.ts` and test |
| Plan copy together with D1 (main plan §15.D), because copy has other gaps beyond DTS and TrueHD. | main plan                                |
| Pin bump per blockers plan §5.                                                                   | —                                        |

## 5. Done when

- A tagged upstream release rewrites DTS and TrueHD to AC-3 under copy.
- Tunarr either allows copy audio on this backend or records why it still refuses it.
