# Issue #1951: VAAPI tonemap always picks OpenCL

> **Status (10/09/2026):** Option C implemented on branch `fix/vaapi-tonemap-opencl-probe` (uncommitted). It adds the OpenCL interop probe in `VaapiHardwareCapabilitiesFactory` and opencl → vaapi → software fallback in `VaapiPipelineBuilder.selectHardwareTonemap`. Option B (transcode-config preference) is the long-term fix and is not started; it only needs to feed `vaapiPipelineOptions.tonemapPreference`. QSV symptom still needs the reporter's ffmpeg command.

## Report

- Intel N100, Docker 1.3.8, `TUNARR_TONEMAP_ENABLED=true`, HDR10 HEVC source.
- VAAPI mode emits `hwmap=derive_device=opencl,tonemap_opencl=...`. The NEO OpenCL runtime lacks VA-API sharing, so ffmpeg fails with `Function not implemented` and the error slate plays.
- Hand-swapping in `tonemap_vaapi=t=bt709:m=bt709:p=bt709` works on the same box.
- QSV mode reportedly emits `scale_vaapi` + `h264_vaapi` with no tonemap.

## VAAPI root cause (confirmed)

- `tonemapPreference` is always `'opencl'`.
  - Only source is `DefaultPipelineOptions` (`server/src/ffmpeg/builder/state/FfmpegState.ts:56-58`).
  - No setting, env var, or API field writes it.
- `VaapiPipelineBuilder.setTonemap` (`server/src/ffmpeg/builder/pipeline/hardware/VaapiPipelineBuilder.ts:384-401`) picks one filter by preference.
  - With preference `opencl`, it never considers `tonemap_vaapi`.
  - It falls back to software only when the opencl filter is absent from the binary.
- `hasFilter` checks the ffmpeg build's filter list (`FfmpegCapabilities.ts:32`), not the device.
  - The bundled ffmpeg compiles in `tonemap_opencl`, so the check always passes.
  - Whether the GPU's OpenCL runtime can map VAAPI frames is never tested.
- `setHardwareAccelState` (`VaapiPipelineBuilder.ts:117-124`) makes the same choice and adds the named OpenCL device init.
- No runtime fallback exists. ffmpeg exits and the session shows the error slate.
- Regression source: `8b850631f` ("prefer opencl tonemapping in vaapi pipeline", 03/16/2026, shipped in v1.3.8).

## Docs drift

- `docs/configure/ffmpeg/transcode_config.md:103` says VAAPI tries `tonemap_vaapi → tonemap_opencl → software`.
- The code tries opencl only, then software. The docs predate `8b850631f`.

## QSV symptom (unexplained)

- QSV mode cannot produce `h264_vaapi` or `scale_vaapi` per the code.
  - `effectiveHwAccel` comes straight from the transcode config (`FfmpegPlaybackParamsCalculator.ts:49`).
  - `PipelineBuilderFactory.ts:130` maps QSV to `QsvPipelineBuilder`, with no fallback.
  - `QsvPipelineBuilder` never emits VAAPI encoders or `scale_vaapi`.
  - With HDR input and the flag on, `QsvPipelineBuilder.setTonemap` (`:595-625`) always adds `vpp_qsv=tonemap=1`. This code shipped in v1.3.8.
- The reported command came from the VAAPI builder. The likely cause is a channel bound to a different transcode config than the one the reporter switched to QSV.
- Minor gap. QSV uses `isHdr()` while VAAPI uses `isHdrContent()`, so QSV skips Dolby Vision. That doesn't apply to this HDR10 report.
- Next step: ask the reporter for the full QSV-mode ffmpeg command from the logs and the channel's transcode config name.

## Fix options

| Option | What | Cost |
|---|---|---|
| A. Flip default to `vaapi` | Prefer `tonemap_vaapi`, then opencl, then software. Matches the docs. | Small. Reverts the `8b850631f` intent, so check why opencl was preferred (likely quality or driver bugs). |
| B. Expose preference | Add a VAAPI tonemap preference to the transcode config. | Schema + migration + UI + API regen. |
| C. Probe OpenCL interop | Test `-init_hw_device vaapi=va:... -init_hw_device opencl@va` once at startup; use opencl only when it succeeds. | Keeps opencl where it works. Adds a probe to hardware capabilities. |

C plus a fallback order of opencl (if probed OK) → vaapi → software fixes the reporter without a config knob. B can follow if users want manual control.
