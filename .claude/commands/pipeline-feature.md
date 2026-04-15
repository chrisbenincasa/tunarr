---
description: Add a feature to the FFmpeg transcode pipeline following Tunarr's pipeline builder pattern
argument-hint: Brief description of the feature (e.g. "crop filter", "AV1 encoder", "noise reduction filter")
---

# Pipeline Feature Development

You are helping a developer add a feature to Tunarr's FFmpeg transcode pipeline.

Feature request: $ARGUMENTS

---

## Phase 1: Understand the request

Determine which pipeline primitive this feature maps to. Ask the user if unclear:

- **Filter** — a video or audio processing step (scale, deinterlace, denoise, crop, overlay, etc.)
- **Encoder** — a new output codec (video or audio)
- **Decoder** — a new input codec handler
- **Input option** — a per-input CLI flag (e.g. `-readrate`, `-reconnect`)
- **Global option** — a top-level ffmpeg flag (e.g. `-thread_queue_size`)
- **Hardware acceleration variant** — a new hwaccel backend for an existing feature

Also confirm: does this apply to **software only**, or does it need **hardware variants** (VAAPI, NVIDIA/CUDA, QSV, VideoToolbox)?

---

## Phase 2: Explore relevant existing code

Before writing anything, read the existing implementation of the nearest equivalent feature to understand conventions. Use these as canonical references:

| What you're adding | Reference implementation to read first |
|---|---|
| Software video filter | `server/src/ffmpeg/builder/filter/ScaleFilter.ts` |
| Software audio filter | `server/src/ffmpeg/builder/filter/LoudnormFilter.ts` |
| VAAPI hardware filter | `server/src/ffmpeg/builder/filter/vaapi/ScaleVaapiFilter.ts` |
| NVIDIA hardware filter | `server/src/ffmpeg/builder/filter/nvidia/ScaleCudaFilter.ts` |
| Software video encoder | `server/src/ffmpeg/builder/encoder/Libx264Encoder.ts` |
| Hardware encoder (VAAPI) | `server/src/ffmpeg/builder/encoder/vaapi/H264VaapiEncoder.ts` |
| Decoder | `server/src/ffmpeg/builder/decoder/H264Decoder.ts` |
| Input option | `server/src/ffmpeg/builder/options/input/HttpReconnectInputOption.ts` |
| Global option | `server/src/ffmpeg/builder/options/GlobalOption.ts` |

Also read the integration point where the equivalent feature is wired in:
- Software filters: `server/src/ffmpeg/builder/pipeline/software/SoftwarePipelineBuilder.ts`
- Hardware filters: the relevant builder in `server/src/ffmpeg/builder/pipeline/hardware/`
- Encoders/decoders: `server/src/ffmpeg/builder/decoder/DecoderFactory.ts` and the relevant pipeline builder's `setupEncoder()`

---

## Phase 3: Clarify before implementing

Before writing code, present any open questions:

- Does this filter modify the frame format? (affects `FrameState` — resolution, pixel format, color space, codec)
- Should it be conditional (e.g. only when HDR is detected, only when deinterlacing is enabled)?
- What pipeline position does it belong in? (before/after scale, before/after encoder, etc.)
- Is it gated by a user-facing config option, or always applied?
- For hardware features: should it fall back to software if the hwaccel device doesn't support it?

Wait for answers before proceeding.

---

## Phase 4: Implement

### Adding a filter

1. Create the filter class in the correct directory:
   - Software: `server/src/ffmpeg/builder/filter/MyFilter.ts`
   - VAAPI: `server/src/ffmpeg/builder/filter/vaapi/MyVaapiFilter.ts`
   - NVIDIA: `server/src/ffmpeg/builder/filter/nvidia/MyCudaFilter.ts`
   - QSV: `server/src/ffmpeg/builder/filter/qsv/MyQsvFilter.ts`

2. Extend the correct base:
   - `FilterOption` for software filters
   - `HardwareFilterOption` for hardware filters (manage pre/post processing filters)

3. Implement the required contract:
   - `get filter(): string` — the ffmpeg filter expression
   - `affectsFrameState: boolean` — set `true` if this changes resolution, pixel format, or color format
   - `nextState(currentState: FrameState): FrameState` — if `affectsFrameState`, return the updated state using `currentState.update({ ... })`

4. Integrate into the pipeline builder. **Critical: FrameState must be threaded correctly** — each filter receives the state from the previous filter and returns the next:
   ```typescript
   // In SoftwarePipelineBuilder.setupVideoFilters():
   if (shouldApplyMyFilter) {
     const f = new MyFilter(params);
     filterChain.videoFilterSteps.push(f);
     if (f.affectsFrameState) {
       currentFrameState = f.nextState(currentFrameState);
     }
   }
   ```

5. If the filter needs hardware variants, implement those separately and integrate them in the respective hardware pipeline builder (`VaapiPipelineBuilder`, `NvidiaPipelineBuilder`, `QsvPipelineBuilder`). Each hardware builder inherits from `SoftwarePipelineBuilder` and overrides `setupVideoFilters()`.

### Adding an encoder

1. Create the encoder in `server/src/ffmpeg/builder/encoder/` (or the hardware subdirectory).
2. Extend `VideoEncoder` (or `AudioEncoder`).
3. Implement:
   - `readonly name: string` — the ffmpeg codec name (e.g. `'libsvtav1'`)
   - `readonly videoFormat: VideoFormat` — output format (e.g. `'av1'`)
   - `options(): string[]` — codec flags and options
4. Wire into the pipeline builder's `setupEncoder()` method, selecting this encoder when the target format matches.

### Adding a decoder

1. Create in `server/src/ffmpeg/builder/decoder/`.
2. Extend `Decoder` (which extends `InputOption`).
3. Implement `readonly name: string`.
4. Register in `DecoderFactory` for the relevant codec and hardware mode.

### Adding an input or global option

1. Create in `server/src/ffmpeg/builder/options/input/` or `server/src/ffmpeg/builder/options/`.
2. Extend `InputOption` or `ConstantGlobalOption`.
3. Implement `options()` returning the CLI arg array.
4. Add to the pipeline in `BasePipelineBuilder.fromContext()` or the relevant setup method.

---

## Phase 5: Write tests

Every new filter, encoder, or pipeline integration needs two layers of tests.

### Unit tests

Place alongside the implementation file (e.g. `MyFilter.test.ts` next to `MyFilter.ts`). These run without real FFmpeg or hardware.

**What to test for a filter:**
- The `filter` string is correct for each relevant input scenario (different resolutions, pixel formats, frame locations)
- If `affectsFrameState` is `true`, assert that `nextState()` returns the expected `FrameState` fields
- If the filter handles hardware frame location (CPU vs GPU), test both paths — the filter should emit a `hwdownload` prefix when frames are on the hardware device

Use `PadFilter.test.ts` as the reference — it covers software, VAAPI 8-bit, VAAPI 10-bit, and CUDA variants with explicit `FrameState` construction.

**What to test for a pipeline builder integration:**
- Build a pipeline with mocked/stub capabilities and assert that the generated command args (`pipeline.getCommandArgs()`) contain the expected filter or option in the expected position
- Test the conditional branches: feature enabled, feature disabled, HDR vs SDR, hardware available vs unavailable

Use `VaapiPipelineBuilder.test.ts` as the reference — it constructs `FfmpegState` and `FrameState` directly and asserts on specific filter types appearing in the pipeline.

**Test setup conventions:**
- Use `FrameState` and `FfmpegState` constructors directly — no DI required
- Create fake `FfmpegCapabilities` via `EmptyFfmpegCapabilities` or stub the relevant `canHandle*` methods
- Use `VideoStream.create(...)` with explicit fields rather than probing real files

### Live integration tests

Place in the same directory as the pipeline builder test, with a `.local.test.ts` suffix (e.g. `SoftwarePipeline.local.test.ts`). These run actual FFmpeg against real fixture files and verify the output is valid media.

**Setup:**
- Import `binaries`, `Fixtures`, `vaapiTest`/`nvidiaTest`/`qsvTest` from `server/src/testing/ffmpeg/FfmpegTestFixtures.ts`
- Use `createTempWorkdir()` from `server/src/testing/ffmpeg/FfmpegIntegrationHelper.ts` for output paths — always clean up in `afterEach`
- Cap test duration to 1 second using `dayjs.duration(1, 'second')` to keep the suite fast
- Use `deriveVideoStreamForFixture(Fixtures.video1080p)` to get a real `VideoInputSource` with correct stream metadata

**Hardware test skipping:**
- Hardware tests must use the extended test fixtures (`vaapiTest`, `nvidiaTest`, `qsvTest`) which auto-skip if the hardware device is not available
- Never use a plain `test()` for hardware paths — it will fail in CI

**What to assert:**
- `runFfmpegWithPipeline()` exits with code `0`
- `probeFile()` on the output file confirms the expected codec, resolution, or pixel format was applied
- If the feature is conditional (e.g. only fires on HDR input), test with `Fixtures.videoHevc1080p` (HDR) and a non-HDR fixture and assert the difference

**Available fixtures** (`server/src/testing/ffmpeg/fixtures/`):
- `Fixtures.video720p` — 720p H.264
- `Fixtures.video1080p` — 1080p H.264
- `Fixtures.video480p43` — 480p H.264 4:3
- `Fixtures.videoHevc720p` / `Fixtures.videoHevc1080p` — HDR10 HEVC
- `Fixtures.watermark` / `Fixtures.blackWatermark` — watermark PNGs

**Environment variables for local hardware testing:**
- `TUNARR_TEST_FFMPEG` / `TUNARR_TEST_FFPROBE` — override binary paths
- `TUNARR_TEST_VAAPI_DEVICE` — override VAAPI device (default `/dev/dri/renderD128`)

### Running the tests

```bash
# Unit tests only (fast, no hardware required)
cd server && pnpm test src/ffmpeg/

# Single test file
cd server && pnpm test src/ffmpeg/builder/filter/MyFilter.test.ts

# Integration tests (requires real FFmpeg and optionally hardware)
cd server && pnpm test src/ffmpeg/builder/pipeline/software/SoftwarePipeline.local.test.ts
```

---

## Phase 6: Verify

After implementing and writing tests:

1. Run `cd server && pnpm typecheck` — the pipeline step type system is strict and will catch interface mismatches.
2. Run `cd server && pnpm test src/ffmpeg/` to confirm all unit tests pass.
3. If adding a hardware variant, confirm the software path is still exercised correctly when hardware is unavailable — hardware builders fall back through `SoftwarePipelineBuilder`.
4. Confirm `FrameState` threading is correct: trace through `setupVideoFilters()` and verify state is updated after every filter that sets `affectsFrameState = true`.

---

## Key architecture reminders

- **Never mutate `FrameState` directly** — always use `currentState.update({ ... })` which returns a new instance.
- **`FilterChain` has four slots**: `videoFilterSteps`, `subtitleOverlayFilterSteps`, `watermarkOverlayFilterSteps`, `pixelFormatFilterSteps` — put filters in the right one.
- **Hardware filters manage frame location** — frames must be uploaded to device memory before hardware filters and downloaded after if software encoding follows. Use the existing upload/download filter patterns.
- **`HardwareFilterOption` pre/post filters** — use `preprocessFilters` and `postProcessFilters` arrays, not ad-hoc insertions.
- **`PipelineBuilderFactory`** — if adding a new hwaccel mode end-to-end, register the new builder here.
