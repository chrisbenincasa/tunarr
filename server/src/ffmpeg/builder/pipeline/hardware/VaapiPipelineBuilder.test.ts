import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import { TONEMAP_ENABLED } from '@/util/env.js';
import { FileStreamSource } from '../../../../stream/types.ts';
import {
  EmptyFfmpegCapabilities,
  FfmpegCapabilities,
} from '../../capabilities/FfmpegCapabilities.ts';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from '../../capabilities/VaapiHardwareCapabilities.ts';
import {
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
} from '../../constants.ts';
import {
  PixelFormatRgba,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import { AudioInputSource } from '../../input/AudioInputSource.ts';
import { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';
import {
  AudioStream,
  EmbeddedSubtitleStream,
  StillImageStream,
  SubtitleMethods,
  VideoStream,
} from '../../MediaStream.ts';
import { KnownFfmpegFilters } from '../../options/KnownFfmpegOptions.ts';
import { AudioState } from '../../state/AudioState.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { VaapiPipelineBuilder } from './VaapiPipelineBuilder.ts';

// Shared test fixtures

const ffmpegVersion = {
  versionString: 'n7.0.2-15-g0458a86656-20240904',
  majorVersion: 7,
  minorVersion: 0,
  patchVersion: 2,
  isUnknown: false,
} as const;

function makeVaapiCapabilities(
  profiles: VaapiProfileEntrypoint[] = [],
): VaapiHardwareCapabilities {
  return new VaapiHardwareCapabilities(profiles);
}

function makeH264DecodeEncodeCapabilities(): VaapiHardwareCapabilities {
  return new VaapiHardwareCapabilities([
    new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Decode),
    new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Encode),
  ]);
}

function makeH264VideoInputNonSquare(): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.withDimensions(1920, 900),
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeH264VideoInputFhd(): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.FHD,
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeH264ProfileVideoInput(
  frameSize = FrameSize.withDimensions(1920, 900),
): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      profile: 'main',
      displayAspectRatio: '16:9',
      frameSize,
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeWatermark(opacity = 100, duration = 5): WatermarkInputSource {
  return new WatermarkInputSource(
    new FileStreamSource('/path/to/watermark.jpg'),
    StillImageStream.create({
      frameSize: FrameSize.withDimensions(800, 600),
      index: 0,
    }),
    {
      duration,
      enabled: true,
      horizontalMargin: 5,
      opacity,
      position: 'bottom-right',
      verticalMargin: 5,
      width: 10,
    },
  );
}

function makePgsSubtitles(source?: FileStreamSource): SubtitlesInputSource {
  return new SubtitlesInputSource(
    source ?? new FileStreamSource('/path/to/video.mkv'),
    [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
    SubtitleMethods.Burn,
  );
}

function makeDesiredFrameState(
  video: VideoInputSource,
  overrides?: Partial<ConstructorParameters<typeof FrameState>[0]>,
): FrameState {
  return new FrameState({
    isAnamorphic: false,
    scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
    paddedSize: FrameSize.FHD,
    pixelFormat: new PixelFormatYuv420P(),
    ...overrides,
  });
}

describe('VaapiPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = makeVaapiCapabilities();
    const binaryCapabilities = EmptyFfmpegCapabilities;
    const video = makeH264VideoInputNonSquare();
    const watermark = makeWatermark();

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      makePgsSubtitles(),
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video),
      DefaultPipelineOptions,
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]pad=1920:1080:-1:-1:color=black[v];[0:5]format=vaapi|yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
        "-map",
        "[vwm]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-sc_threshold",
        "0",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work, decoding disabled', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = EmptyFfmpegCapabilities;
    const video = makeH264VideoInputNonSquare();
    const watermark = makeWatermark();

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      makePgsSubtitles(),
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video, { videoFormat: 'h264' }),
      { ...DefaultPipelineOptions, disableHardwareDecoding: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]pad=1920:1080:-1:-1:color=black[v];[0:5]format=vaapi|yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12|p010le|vaapi,hwupload=extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "h264_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work, encoding disabled', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = EmptyFfmpegCapabilities;
    const video = makeH264ProfileVideoInput();
    const watermark = makeWatermark(100, 0);

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      null,
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video, { videoFormat: 'h264' }),
      { ...DefaultPipelineOptions, disableHardwareEncoding: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0[vwm]",
        "-map",
        "[vwm]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "nv12",
        "-sc_threshold",
        "0",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work, filters disabled', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = EmptyFfmpegCapabilities;
    const video = makeH264ProfileVideoInput();
    const watermark = makeWatermark();

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      makePgsSubtitles(),
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video, { videoFormat: 'h264' }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[0:5]format=vaapi|yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12,hwupload=extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "h264_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('basic audio-only stream', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = EmptyFfmpegCapabilities;

    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/image.png'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
        pixelFormat: new PixelFormatRgba(),
      }),
    );

    const audio = AudioInputSource.withStream(
      new FileStreamSource('/path/to/song.flac'),
      AudioStream.create({
        channels: 2,
        codec: 'flac',
        index: 0,
      }),
      AudioState.create({
        audioBitrate: 192,
        audioBufferSize: 192 * 2,
        audioChannels: 2,
      }),
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      audio,
      null,
      null,
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-readrate",
        "1",
        "-i",
        "/path/to/image.png",
        "-readrate",
        "1",
        "-i",
        "/path/to/song.flac",
        "-filter_complex",
        "[0:0]scale=1920:1080:flags=fast_bilinear:force_original_aspect_ratio=decrease,setsar=1,pad=1920:1080:-1:-1:color=black,loop=-1:1[v];[1:0]aresample=async=1[a];[v]format=nv12,hwupload=extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "[a]",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "h264_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-maxrate:a",
        "192k",
        "-bufsize:a",
        "384k",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  describe('scale behavior', () => {
    test('does not emit unnecessary scale filter when input is already at desired size (software decode)', () => {
      // Bug 2: VaapiPipelineBuilder.setScale() else branch creates ScaleVaapiFilter unconditionally.
      // When input size == desired size AND pixelFormat is null (which it always is for non-CUDA paths),
      // ScaleVaapiFilter.genFilter() returns '' → isNonEmptyString guard prevents filter from being added.
      // This test documents the current behavior (no scale filter for equal sizes with software decode).
      const capabilities = makeVaapiCapabilities(); // no decode/encode capabilities
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264VideoInputFhd(); // Already at FHD

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const state = FfmpegState.create({ version: ffmpegVersion });

      // Desired output is also FHD - sizes are equal
      const out = builder.build(
        state,
        new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.FHD,
          paddedSize: FrameSize.FHD,
          pixelFormat: new PixelFormatYuv420P(),
        }),
        DefaultPipelineOptions,
      );

      // Document current behavior: ScaleVaapiFilter is in the else branch but
      // genFilter() returns '' for equal sizes with null pixelFormat → no scale emitted
      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-c:v",
          "h264",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-map",
          "0:0",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-sc_threshold",
          "0",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('does not emit unnecessary scale filter when VAAPI-decoded input is already at desired size', () => {
      // Bug 2 variant: VAAPI hardware decode path, equal sizes.
      // setScale else branch fires because decoderMode===VAAPI makes the if-condition false.
      // ScaleVaapiFilter.genFilter() returns '' for equal sizes with null pixelFormat → no filter.
      const capabilities = makeH264DecodeEncodeCapabilities();
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264VideoInputFhd(); // Already at FHD

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      // Pass vaapiDevice so hardware path activates
      const state = FfmpegState.create({
        version: ffmpegVersion,
        vaapiDevice: '/dev/dri/renderD128',
      });

      const out = builder.build(
        state,
        new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.FHD,
          paddedSize: FrameSize.FHD,
          pixelFormat: new PixelFormatYuv420P(),
          videoFormat: 'h264',
        }),
        DefaultPipelineOptions,
      );

      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-vaapi_device",
          "/dev/dri/renderD128",
          "-c:v",
          "h264",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-filter_complex",
          "[0:0]format=nv12|p010le|vaapi,hwupload=extra_hw_frames=64[vpf]",
          "-map",
          "[vpf]",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-noautoscale",
          "-c:v",
          "h264_vaapi",
          "-sei",
          "-a53_cc",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });
  });

  describe('watermark opacity handling', () => {
    test('does not emit opacity filter for fully opaque watermark (opacity=100)', () => {
      // opacity=100 → inRange(100, 0, 100) = false → no opacity filter (correct)
      // Also consistent with NVIDIA which uses: opacity !== 100 → false → no filter
      const capabilities = makeH264DecodeEncodeCapabilities();
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264ProfileVideoInput();
      const watermark = makeWatermark(100);

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        watermark,
        null,
        null,
      );

      const state = FfmpegState.create({ version: ffmpegVersion });

      const out = builder.build(
        state,
        makeDesiredFrameState(video, { videoFormat: 'h264' }),
        DefaultPipelineOptions,
      );

      const args = out.getCommandArgs().join(' ');
      expect(args).not.toContain('opacity');
      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-threads",
          "1",
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-extra_hw_frames",
          "64",
          "-hwaccel_output_format",
          "vaapi",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-i",
          "/path/to/watermark.jpg",
          "-filter_complex",
          "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12,hwupload=extra_hw_frames=64[vpf]",
          "-map",
          "[vpf]",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-noautoscale",
          "-c:v",
          "h264_vaapi",
          "-sei",
          "-a53_cc",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('emits opacity filter for opacity=50 (partially transparent watermark)', () => {
      // opacity=50 → inRange(50, 0, 100) = true → opacity filter added
      // Bug 3 note: VAAPI passes opacity directly (50), not divided by 100 like Software/NVIDIA
      const capabilities = makeH264DecodeEncodeCapabilities();
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264ProfileVideoInput();
      const watermark = makeWatermark(50);

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        watermark,
        null,
        null,
      );

      const state = FfmpegState.create({ version: ffmpegVersion });

      const out = builder.build(
        state,
        makeDesiredFrameState(video, { videoFormat: 'h264' }),
        DefaultPipelineOptions,
      );

      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-threads",
          "1",
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-extra_hw_frames",
          "64",
          "-hwaccel_output_format",
          "vaapi",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-i",
          "/path/to/watermark.jpg",
          "-filter_complex",
          "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,colorchannelmixer=aa=0.5,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12,hwupload=extra_hw_frames=64[vpf]",
          "-map",
          "[vpf]",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-noautoscale",
          "-c:v",
          "h264_vaapi",
          "-sei",
          "-a53_cc",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('emits opacity filter for opacity=0 (fully transparent watermark)', () => {
      // Bug 3: VAAPI uses inRange(opacity, 0, 100) → inRange(0, 0, 100) = true → filter added
      // NVIDIA uses opacity !== 100 → 0 !== 100 = true → filter added
      // Both are consistent here. VAAPI passes 0 directly (not 0/100=0).
      const capabilities = makeH264DecodeEncodeCapabilities();
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264ProfileVideoInput();
      const watermark = makeWatermark(0);

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        watermark,
        null,
        null,
      );

      const state = FfmpegState.create({ version: ffmpegVersion });

      const out = builder.build(
        state,
        makeDesiredFrameState(video, { videoFormat: 'h264' }),
        DefaultPipelineOptions,
      );

      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-threads",
          "1",
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-extra_hw_frames",
          "64",
          "-hwaccel_output_format",
          "vaapi",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-i",
          "/path/to/watermark.jpg",
          "-filter_complex",
          "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,colorchannelmixer=aa=0,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12,hwupload=extra_hw_frames=64[vpf]",
          "-map",
          "[vpf]",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-noautoscale",
          "-c:v",
          "h264_vaapi",
          "-sei",
          "-a53_cc",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });
  });

  describe('software overlay flag (Bug 1 - forceSoftwareOverlay direct mutation)', () => {
    test('radeonsi driver forces software overlay for watermarks', () => {
      // Bug 1: VaapiPipelineBuilder.setupVideoFilters() directly mutates currentState:
      //   currentState.forceSoftwareOverlay = forceSoftwareOverlay;
      // The correct approach is: currentState = currentState.update({ forceSoftwareOverlay })
      // This test documents that the radeonsi path correctly activates software overlay
      // (the mutation works despite being a bug pattern).
      const capabilities = makeH264DecodeEncodeCapabilities();
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264ProfileVideoInput();
      const watermark = makeWatermark();

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        watermark,
        makePgsSubtitles(),
        null,
      );

      // BUG 1: vaapiDriver='radeonsi' sets forceSoftwareOverlay=true via direct mutation
      const state = FfmpegState.create({
        version: ffmpegVersion,
        vaapiDriver: 'radeonsi',
        vaapiDevice: '/dev/dri/renderD128',
      });

      const out = builder.build(
        state,
        makeDesiredFrameState(video, { videoFormat: 'h264' }),
        DefaultPipelineOptions,
      );

      // With radeonsi, software overlay path should be used (no VAAPI overlay filters)
      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-threads",
          "1",
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-hwaccel",
          "vaapi",
          "-vaapi_device",
          "/dev/dri/renderD128",
          "-extra_hw_frames",
          "64",
          "-hwaccel_output_format",
          "vaapi",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-i",
          "/path/to/watermark.jpg",
          "-filter_complex",
          "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[0:5]format=vaapi|yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12,hwupload=extra_hw_frames=64[vpf]",
          "-map",
          "[vpf]",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-noautoscale",
          "-c:v",
          "h264_vaapi",
          "-sei",
          "-a53_cc",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('watermark + subtitle forces software overlay', () => {
      // Bug 1: The condition (hasWatermark && hasSubtitleOverlay()) → forceSoftwareOverlay=true
      // is applied via direct mutation. This test documents the behavior.
      const capabilities = makeH264DecodeEncodeCapabilities();
      const binaryCapabilities = EmptyFfmpegCapabilities;
      const video = makeH264ProfileVideoInput();
      const watermark = makeWatermark();

      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        watermark,
        makePgsSubtitles(),
        null,
      );

      const state = FfmpegState.create({
        version: ffmpegVersion,
        vaapiDevice: '/dev/dri/renderD128',
      });

      const out = builder.build(
        state,
        makeDesiredFrameState(video, { videoFormat: 'h264' }),
        DefaultPipelineOptions,
      );

      expect(out.getCommandArgs()).toMatchInlineSnapshot(`
        [
          "-threads",
          "1",
          "-nostdin",
          "-hide_banner",
          "-nostats",
          "-loglevel",
          "error",
          "-fflags",
          "+genpts+discardcorrupt+igndts",
          "-hwaccel",
          "vaapi",
          "-vaapi_device",
          "/dev/dri/renderD128",
          "-extra_hw_frames",
          "64",
          "-hwaccel_output_format",
          "vaapi",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-i",
          "/path/to/watermark.jpg",
          "-filter_complex",
          "[0:0]hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[0:5]format=vaapi|yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm];[vwm]format=nv12,hwupload=extra_hw_frames=64[vpf]",
          "-map",
          "[vpf]",
          "-map",
          "0:a",
          "-muxdelay",
          "0",
          "-muxpreload",
          "0",
          "-flags",
          "cgop",
          "-movflags",
          "+faststart",
          "-noautoscale",
          "-c:v",
          "h264_vaapi",
          "-sei",
          "-a53_cc",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });
  });
});

describe('VaapiPipelineBuilder tonemap', () => {
  const originalEnv = process.env;
  const fakeVersion = {
    versionString: 'n7.0.2',
    majorVersion: 7,
    minorVersion: 0,
    patchVersion: 2,
    isUnknown: false,
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  function createHdrVideoStream(
    colorFormat: ColorFormat = new ColorFormat({
      colorRange: ColorRanges.Tv,
      colorSpace: ColorSpaces.Bt2020nc,
      colorPrimaries: ColorPrimaries.Bt2020,
      colorTransfer: ColorTransferFormats.Smpte2084,
    }),
  ): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: colorFormat,
    });
  }

  function buildWithTonemap(opts: {
    videoStream: VideoStream;
    binaryCapabilities?: FfmpegCapabilities;
    disableHardwareFilters?: boolean;
  }) {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.HevcMain10,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.HevcMain,
        VaapiEntrypoint.Encode,
      ),
    ]);

    const binaryCapabilities =
      opts.binaryCapabilities ??
      new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
      );

    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      opts.videoStream,
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      null,
      null,
    );

    const state = FfmpegState.create({ version: fakeVersion });

    const pipeline = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'hevc',
      }),
      {
        ...DefaultPipelineOptions,
        vaapiDevice: '/dev/dri/renderD128',
        disableHardwareFilters: opts.disableHardwareFilters ?? false,
      },
    );

    return pipeline;
  }

  function hasTonemapFilter(pipeline: ReturnType<typeof buildWithTonemap>) {
    const args = pipeline.getCommandArgs().join(' ');
    return args.includes('tonemap_vaapi');
  }

  function hasOpenclTonemapFilter(
    pipeline: ReturnType<typeof buildWithTonemap>,
  ) {
    const args = pipeline.getCommandArgs().join(' ');
    return args.includes('tonemap_opencl');
  }

  test('applies tonemap filter for HDR10 (smpte2084) content', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(
        new ColorFormat({
          colorRange: ColorRanges.Tv,
          colorSpace: ColorSpaces.Bt2020nc,
          colorPrimaries: ColorPrimaries.Bt2020,
          colorTransfer: ColorTransferFormats.Smpte2084,
        }),
      ),
    });

    expect(hasTonemapFilter(pipeline)).to.eq(true);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709');
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709,scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('applies tonemap filter for HLG (arib-std-b67) content', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(
        new ColorFormat({
          colorRange: ColorRanges.Tv,
          colorSpace: ColorSpaces.Bt2020nc,
          colorPrimaries: ColorPrimaries.Bt2020,
          colorTransfer: ColorTransferFormats.AribStdB67,
        }),
      ),
    });

    expect(hasTonemapFilter(pipeline)).to.eq(true);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709,scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('skips tonemap when TONEMAP_ENABLED is false', () => {
    process.env[TONEMAP_ENABLED] = 'false';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('skips tonemap when content is SDR', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const sdrStream = VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FHD,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt709,
        colorPrimaries: ColorPrimaries.Bt709,
        colorTransfer: ColorTransferFormats.Bt709,
      }),
    });

    const pipeline = buildWithTonemap({ videoStream: sdrStream });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('skips tonemap when ffmpeg lacks both tonemap_vaapi and tonemap_opencl filters', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('skips tonemap when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      disableHardwareFilters: true,
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('tonemap filter appears before scale in the filter chain', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    const args = pipeline.getCommandArgs().join(' ');
    const tonemapIndex = args.indexOf('tonemap_vaapi');
    const scaleIndex = args.indexOf('scale_vaapi');

    expect(tonemapIndex).toBeGreaterThan(-1);
    expect(scaleIndex).toBeGreaterThan(-1);
    expect(tonemapIndex).toBeLessThan(scaleIndex);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709,scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('falls back to tonemap_opencl when tonemap_vaapi is unavailable', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapOpencl]),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(args).toContain('tonemap_opencl=tonemap=hable');
    expect(args).toContain('hwmap=derive_device=opencl');
    expect(args).toContain('hwmap=derive_device=vaapi:reverse=1');
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]hwmap=derive_device=opencl,tonemap_opencl=tonemap=hable:desat=0:t=bt709:m=bt709:p=bt709:format=nv12,hwmap=derive_device=vaapi:reverse=1,scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('prefers tonemap_vaapi over tonemap_opencl when both are available', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([
          KnownFfmpegFilters.TonemapVaapi,
          KnownFfmpegFilters.TonemapOpencl,
        ]),
        new Set(),
      ),
    });

    expect(hasTonemapFilter(pipeline)).to.eq(true);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709,scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('opencl tonemap filter appears before scale in the filter chain', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapOpencl]),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    const tonemapIndex = args.indexOf('tonemap_opencl');
    const scaleIndex = args.indexOf('scale_vaapi');

    expect(tonemapIndex).toBeGreaterThan(-1);
    expect(scaleIndex).toBeGreaterThan(-1);
    expect(tonemapIndex).toBeLessThan(scaleIndex);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]hwmap=derive_device=opencl,tonemap_opencl=tonemap=hable:desat=0:t=bt709:m=bt709:p=bt709:format=nv12,hwmap=derive_device=vaapi:reverse=1,scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('skips opencl tonemap when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapOpencl]),
        new Set(),
      ),
      disableHardwareFilters: true,
    });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(pipeline.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-extra_hw_frames",
        "64",
        "-hwaccel_output_format",
        "vaapi",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale_vaapi=1920:1080:extra_hw_frames=64:force_divisible_by=2,setsar=1[v];[v]scale_vaapi=format=nv12:extra_hw_frames=64[vpf]",
        "-map",
        "[vpf]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-noautoscale",
        "-c:v",
        "hevc_vaapi",
        "-sei",
        "-a53_cc",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  describe('tonemapHdr state flag', () => {
    test('Bug 6: ffmpegState.tonemapHdr should be true after VAAPI tonemapping activates', () => {
      process.env[TONEMAP_ENABLED] = 'true';

      const capabilities = new VaapiHardwareCapabilities([
        new VaapiProfileEntrypoint(
          VaapiProfiles.HevcMain10,
          VaapiEntrypoint.Decode,
        ),
        new VaapiProfileEntrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.Encode),
      ]);
      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
      );
      const video = VideoInputSource.withStream(
        new FileStreamSource('/path/to/video.mkv'),
        createHdrVideoStream(),
      );
      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );
      const state = FfmpegState.create({ version: fakeVersion });
      builder.build(
        state,
        new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.FHD,
          paddedSize: FrameSize.FHD,
          pixelFormat: new PixelFormatYuv420P(),
          videoFormat: 'hevc',
        }),
        { ...DefaultPipelineOptions, vaapiDevice: '/dev/dri/renderD128' },
      );

      // Bug 6 (before fix): state.tonemapHdr === false even though tonemap_vaapi filter is active
      // After fix: state.tonemapHdr === true
      expect(state.tonemapHdr).toBe(true);
    });

    test('ffmpegState.tonemapHdr remains false when TONEMAP_ENABLED is not set', () => {
      // No process.env[TONEMAP_ENABLED] — default is false, no tonemapping
      const capabilities = new VaapiHardwareCapabilities([
        new VaapiProfileEntrypoint(
          VaapiProfiles.HevcMain10,
          VaapiEntrypoint.Decode,
        ),
        new VaapiProfileEntrypoint(VaapiProfiles.HevcMain, VaapiEntrypoint.Encode),
      ]);
      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
      );
      const video = VideoInputSource.withStream(
        new FileStreamSource('/path/to/video.mkv'),
        createHdrVideoStream(),
      );
      const builder = new VaapiPipelineBuilder(
        capabilities,
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );
      const state = FfmpegState.create({ version: fakeVersion });
      builder.build(
        state,
        new FrameState({
          isAnamorphic: false,
          scaledSize: FrameSize.FHD,
          paddedSize: FrameSize.FHD,
          pixelFormat: new PixelFormatYuv420P(),
          videoFormat: 'hevc',
        }),
        { ...DefaultPipelineOptions, vaapiDevice: '/dev/dri/renderD128' },
      );

      expect(state.tonemapHdr).toBe(false);
    });
  });
});
