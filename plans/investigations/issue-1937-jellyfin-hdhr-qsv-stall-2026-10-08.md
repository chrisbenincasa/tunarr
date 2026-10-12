# Issue #1937: Jellyfin HDHR playback fails on QSV (DS423+)

> **Status (10/08/2026):** Closed as not planned (hardware/driver limits). Findings posted on #1937. Aspect-ratio bug filed as #2256.

## Finding

- Jellyfin receives zero bytes because Tunarr's transcode ffmpeg never writes a segment before the 15 s readiness timeout.
- `tunarr.log` shows 6 attempts. 5 never wrote a playlist (`num segments=0`, 88 polls). 1 started, taking 8 s for the first 4 s segment despite `-readrate_initial_burst 60`.
- After each timeout the transcode ffmpeg ignores SIGTERM for 15 s and needs SIGKILL. That points to a call blocked in the GPU driver, not slow software.
- The `.ts` and `hls_direct_v2` URLs are both normal. HDHR always serves `.ts` (MPEG-TS wrapped around the HLS session). The `hls_direct_v2` URLs came from an older Jellyfin tuner setup.

## Pipeline on this host

Input is HEVC Main10 720x480, DAR 16:9, SAR 0:0. Host CPU is a Celeron J4125 (Gemini Lake).

```
vpp_qsv=w=iw*sar:h=ih,setsar=1,vpp_qsv=w=1620:h=1080,
hwdownload,format=p010le,pad=1920:1080,setpts=PTS-STARTPTS,fps=24
-> format=p010le,hwupload=extra_hw_frames=64,vpp_qsv=format=nv12 -> h264_qsv
```

- Every frame goes GPU -> CPU -> GPU at 1080p 10-bit, padded and frame-rate converted on one CPU thread.
- `QsvPipelineBuilder.ts:173` downloads unconditionally after pad, so the round trip happens even without padding.
- The frames stay 10-bit through download and pad, then convert to NV12 after upload. That doubles transfer size for an 8-bit output.

## Bug: DAR fallback never runs (`MediaStream.ts:93-170`)

- `parseFloat("16:9")` returns `16`, not `NaN`, so the `split(':')` branch is dead. Computed SAR is 10.67 instead of 1.185.
- `squarePixelFrameSize` multiplies both width and height by SAR, so anamorphic correction never changes the shape.
- Result for this file is 1620x1080 (3:2) plus pillarbox, when it should be 1920x1080 with no pad. The picture is horizontally squeezed.
- Affects every pipeline, not only QSV. It is not the cause of the stall.

## Open questions

- Why ffmpeg blocks. The ffmpeg stderr tail is only logged on unexpected exits, and these kills are "expected". The user has file logging on (`-loglevel debug`), so `ffmpeg-report-*.log` files in the Tunarr logs directory should show the last frame processed.
- Whether a second commenter's Ubuntu 26.04 regression is the same driver-level stall (new kernel and `intel-media-driver`).

## Asks for the reporter

- Attach one `ffmpeg-report-*-transcode-*.log` from a failed attempt.
- Try the VAAPI transcode profile on the same channel.
