# Issue #2071: "Error reinitializing filters" on looped filler with CUDA

> **Status (10/10/2026):** Reproduced locally. Root cause is an ffmpeg bug triggered by `-stream_loop` with CUDA frames. Fixed the trigger: only slot fallback filler loops now (`StreamProgramCalculator.ts`). Looped fallback filler on NVIDIA can still hit the ffmpeg bug (option 1 below, not done).

## Reproduction

- Machine: GTX 1080, Linux.
- ffmpeg builds: 6.1.1 (system), n7.1.1-56-gc2184b65d2 (reporter's exact build), master N-119918 (06/18/2025).
- Input: synthetic 4 s 1080p H.264 + AAC clip.
- Command shape: the reporter's command, with `-t 7` so the input must wrap once.

| Variant | Result |
|---|---|
| `-hwaccel cuda -hwaccel_output_format cuda`, no loop | OK |
| same + `-stream_loop 1` | Fails at the wrap, all three builds |
| same + `-stream_loop -1` (current `main`) | Fails |
| same + `-reinit_filter 0` | Still fails |
| Passthrough `[0:0]null` instead of `scale_cuda` | Still fails |
| `hwdownload ... hwupload_cuda` + `scale_cuda` (reporter's other shape) | Still fails |
| `-hwaccel cuda` without `-hwaccel_output_format cuda`, then `format=nv12,hwupload_cuda,scale_cuda` | OK (6.1.1, 7.1.1) |
| Software decode, then `hwupload_cuda,scale_cuda` | OK (6.1.1, 7.1.1) |

Error text matches the report exactly. Exit code -38 on Linux vs -40 on Windows is the same ENOSYS.

## Mechanism

- At the loop point the h264 decoder reinitializes and creates a new CUDA frames context.
- ffmpeg sees a changed `hw_frames_ctx` and rebuilds the filter graph, even though size and format are unchanged.
- On the rebuild, the output sink cannot accept `scale_cuda` output, so ffmpeg inserts `auto_scale_0` after it and fails to negotiate.
- Any CUDA-decoded input with `-hwaccel_output_format cuda` fails this way when it loops. Filter choice does not matter.

## Why the loop turns on

- `StreamProgramCalculator.ts:366` sets `infiniteLoop: backingItem.duration < streamDuration` for filler-list (`commercial`) content items.
- That path does not cap `streamDuration` at the clip length. The flex/fallback path does (`:533-536`), so it never loops a clip that fits. This matches the report: the same clip works as flex.
- Slot filler lineup items copy `program.duration` at schedule time (`slotSchedulerUtil.ts:320`, `:366`). The loop therefore means the stored program duration later fell below the lineup duration. Likely causes are a rescan that changed the duration or fractional local-media durations (see the float-duration note in #2032). Not confirmed without the reporter's DB.
- A sub-second overrun loops the whole clip, and the wrap crashes the stream right as the filler ends.

## Decision (10/10/2026)

- Only slot fallback filler (`fillerType: 'fallback'`) loops. Head, pre, post, tail, and mid filler play once.
- The loop is capped at the lineup item's duration. `calculateStreamDuration` already enforces this.

## Fix options

1. In the NVIDIA pipeline, skip `-hwaccel_output_format cuda` when the input loops. Decode on the GPU into system memory and `hwupload_cuda` before the CUDA filters. Verified working. Costs one GPU-to-CPU copy per frame, only for looped inputs.
2. Stop spurious loops. Cap `streamDuration` at the clip length for commercial items, or loop only when the overrun is larger than a tolerance. This fixes the reporter's case but not true loops.
3. Do both. Option 2 removes the common trigger and option 1 protects intentional loops.

Other pipelines (VAAPI, QSV) likely share the frames-context problem. Not tested.

## Not investigated

- Orphaned ffmpeg processes after the crash.
- The report that disabling hardware filters still produced `scale_cuda`.
