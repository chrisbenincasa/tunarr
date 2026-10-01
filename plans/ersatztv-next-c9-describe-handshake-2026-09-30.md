# ErsatzTV next — C9 capability handshake

> **Status (09/30/2026):** Planned. Verified against upstream `091e174`. Nothing filed. Not a ship gate. Next step is the design issue in §3, after B2's issue, so the maintainer isn't handed two design threads at once.

Part of [`ersatztv-next-upstream-blockers-2026-09-30.md`](ersatztv-next-upstream-blockers-2026-09-30.md). The argument is in main plan §15.C, "C9 in full."

## 1. Verified state at `091e174`

- `ersatztv-channel` has two subcommands, `run` and `debug` (`crates/ersatztv-channel/src/main.rs:25-42`), and clap's `--version`, which prints `ersatztv_core::VERSION`.
- `debug` loads the config, prints `FfmpegInfo` with `{:?}`, and builds the accel pipeline (`main.rs:80-105`). Its output is a debug dump, not a contract.
- `FfmpegInfo` already derives `Serialize` (`ffpipeline/src/ffmpeg_info.rs:128`).
- `crates/ffpipeline/src/bin/probe_capabilities.rs` probes each accel (AMF, CUDA, QSV, RKMPP, VAAPI, VideoToolbox, Vulkan, OpenCL) for decode, encode and VPP formats, and prints a table. It is a dev tool and is not shipped.
- The constants a downstream needs are scattered:
  - `SUPPORTED_SCHEMA` in `ersatztv-playout/src/playout.rs:14`
  - `READY_FILE_NAME` and `HEARTBEAT_FILE_NAME` in `ersatztv-core/src/lib.rs:11-14`
  - the playlist filenames in `channel_session.rs:113-135`
  - segment and keyframe lengths in `ffpipeline/src/pipeline.rs:37-38`.
- `channel_config.json` has no version (C3).

## 2. Proposed shape

A third subcommand, `ersatztv-channel describe`, that prints one JSON document to stdout and exits 0. A subcommand fits the existing CLI better than a flag. The values below come from HEAD, but the field names are a proposal.

```json
{
  "describe_version": 1,
  "binary": { "version": "0.2.0", "commit": "091e174" },
  "contract": {
    "playout_schema": { "breaking": 0, "compatible": 4 },
    "channel_config_schema": null,
    "dynamic_callback": 1,
    "output_files": {
      "playlist": "live.m3u8",
      "subtitle_playlist": "live_sub.m3u8",
      "ffmpeg_playlist": "ffmpeg.m3u8",
      "segment_pattern": "live%06d.ts",
      "ready": ".ready",
      "heartbeat": ".heartbeat"
    },
    "segment_seconds": 4,
    "keyframe_seconds": 2
  },
  "schema_capability": {
    "video_formats": ["h264", "hevc", "mpeg2video"],
    "audio_formats": ["aac", "ac3"],
    "accels": ["amf", "cuda", "qsv", "rkmpp", "vaapi", "videotoolbox", "vulkan"]
  },
  "runtime_capability": null
}
```

- **Contract layer.** Read every value from the constant that already defines it, so `describe` can't drift from the code.
- **Schema capability.** Derive the enum lists from the config enums with `strum` or `schemars`, not hand-written lists.
- **Runtime capability.** Off by default, because probing takes time and needs a config. `describe --probe <config>` fills it from `FfmpegInfo::load` and the per-accel capability probes `probe_capabilities` already uses. Move the shared probe code from the bin into the library.
- `describe_version` versions the document itself. Adding fields is compatible. Removing or renaming fields bumps it.
- `channel_config_schema` stays `null` until C3 adds a version.

## 3. Design issue

- **Title:** `feat: machine-readable describe subcommand`
- **Case without Tunarr:** legacy ErsatzTV also hardcodes the output filenames and the supported formats. One document replaces several implicit couplings for every integrator.
- **Shape to agree:**
  - subcommand or flag
  - which constants belong in the contract layer
  - whether the runtime layer belongs in v1 or a follow-up.
- **Offer** to send the PR. Propose two PRs, contract and schema layers first, runtime layer second, so the first one is small.

## 4. Tunarr follow-up

| Change                                                                                                                                                                                     | Where                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Run `describe` once at startup and cache it. Refuse the backend when `playout_schema` doesn't accept Tunarr's emitted version, or when the output filenames differ from what Tunarr reads. | `EtvNextBinaryResolver.ts`                       |
| Read supported formats from `describe` instead of the generated enums. A refusal then tracks the installed binary, not the vendored schema.                                                | `EtvNextChannelConfigMapper.ts:76`               |
| Once the runtime layer exists, show the probed accels on the troubleshooting page.                                                                                                         | `TroubleshootService.ts`, `TroubleshootPage.tsx` |
| Evaluate whether the runtime layer can replace Tunarr's own capability code (`server/src/ffmpeg/builder/capabilities`, 1,312 lines) for `etv_next` channels. Separate plan.                | —                                                |

## 5. Done when

- A tagged upstream release ships `describe` with at least the contract and schema layers.
- Tunarr validates the binary against `describe` at startup.
