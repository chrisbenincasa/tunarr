import { FileStreamSource } from '../../../../stream/types.ts';
import { TUNARR_ENV_VARS } from '../../../../util/env.ts';
import { LoggerFactory } from '../../../../util/logging/LoggerFactory.ts';
import {
  EmptyFfmpegCapabilities,
  FfmpegCapabilities,
} from '../../capabilities/FfmpegCapabilities.ts';
import { NvidiaHardwareCapabilities } from '../../capabilities/NvidiaHardwareCapabilities.ts';
import {
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
  NullOutputFormat,
} from '../../constants.ts';
import { DeinterlaceFilter } from '../../filter/DeinterlaceFilter.ts';
import { LibplaceboTonemapFilter } from '../../filter/LibplaceboTonemapFilter.ts';
import { ColorFormat } from '../../format/ColorFormat.ts';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';
import {
  EmbeddedSubtitleStream,
  StillImageStream,
  SubtitleMethods,
  VideoStream,
} from '../../MediaStream.ts';
import { ThreadCountOption } from '../../options/GlobalOption.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { NvidiaPipelineBuilder } from './NvidiaPipelineBuilder.ts';

// Shared test fixtures

const ffmpegVersion = {
  versionString: 'n7.0.2-15-g0458a86656-20240904',
  majorVersion: 7,
  minorVersion: 0,
  patchVersion: 2,
  isUnknown: false,
} as const;

function makeH264VideoInput(frameSize = FrameSize.FHD) {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize,
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
      colorFormat: ColorFormat.unknown,
    }),
  );
}

function makeH264VideoInputNonSquare() {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.withDimensions(1920, 900),
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
      colorFormat: ColorFormat.unknown,
    }),
  );
}

function makeH264VideoInput720p() {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.SevenTwenty,
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
      colorFormat: ColorFormat.unknown,
    }),
  );
}

const hdrColorFormat = new ColorFormat({
  colorRange: ColorRanges.Tv,
  colorSpace: ColorSpaces.Bt2020nc,
  colorTransfer: ColorTransferFormats.Smpte2084,
  colorPrimaries: ColorPrimaries.Bt2020,
});

function makeHdrVideoInput() {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/hdr-video.mkv'),
    VideoStream.create({
      codec: 'hevc',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.FHD,
      index: 0,
      pixelFormat: new PixelFormatYuv420P10Le(),
      providedSampleAspectRatio: null,
      colorFormat: hdrColorFormat,
    }),
  );
}

function makeWatermark(opacity = 100) {
  return new WatermarkInputSource(
    new FileStreamSource('/path/to/watermark.jpg'),
    StillImageStream.create({
      frameSize: FrameSize.withDimensions(800, 600),
      index: 0,
    }),
    {
      duration: 5,
      enabled: true,
      horizontalMargin: 5,
      opacity,
      position: 'bottom-right',
      verticalMargin: 5,
      width: 10,
    },
  );
}

function makePgsSubtitles(source?: FileStreamSource) {
  return new SubtitlesInputSource(
    source ?? new FileStreamSource('/path/to/video.mkv'),
    [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
    SubtitleMethods.Burn,
  );
}

function makeDesiredFrameState(
  video: VideoInputSource,
  overrides?: Partial<ConstructorParameters<typeof FrameState>[0]>,
) {
  return new FrameState({
    isAnamorphic: false,
    scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
    paddedSize: FrameSize.FHD,
    pixelFormat: new PixelFormatYuv420P(),
    ...overrides,
  });
}

function makeNvidiaCapabilities(smArch = 75) {
  return new NvidiaHardwareCapabilities('RTX 2080 Ti', smArch);
}

describe('NvidiaPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = makeNvidiaCapabilities();
    const video = makeH264VideoInputNonSquare();
    const videoSource = new FileStreamSource('/path/to/video.mkv');
    const watermark = makeWatermark();

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      makePgsSubtitles(),
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video),
      DefaultPipelineOptions,
    );

    const thread = out.steps.find((step) => step instanceof ThreadCountOption);
    expect(thread).toBeInstanceOf(ThreadCountOption);
    expect(thread?.options()).toEqual(['-threads', '1']);
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
        "-init_hw_device",
        "cuda",
        "-hwaccel",
        "cuda",
        "-hwaccel_output_format",
        "cuda",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v];[0:5]format=yuva420p,scale=1920:1080:force_original_aspect_ratio=decrease,hwupload_cuda[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay_cuda=x=(W-w)/2:y=(H-h)/2,hwdownload,format=yuv420p[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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
        "-c:v",
        "h264_nvenc",
        "-rc-lookahead",
        "20",
        "-bsf:v",
        "h264_metadata=crop_bottom=8",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work software decode', () => {
    const capabilities = makeNvidiaCapabilities();
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mp2'),
      VideoStream.create({
        codec: 'mpeg2video',
        profile: 'main',
        displayAspectRatio: '4:3',
        frameSize: FrameSize.withDimensions(352, 480),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: '1:1',
        colorFormat: ColorFormat.unknown,
      }),
    );

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      null,
      null,
    );

    const state = FfmpegState.create({
      version: ffmpegVersion,
      softwareDeinterlaceFilter: 'none',
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        deinterlace: true,
      }),
      DefaultPipelineOptions,
    );

    const deinterlace = out
      .getComplexFilter()
      ?.filterChain.videoFilterSteps.find(
        (step) => step instanceof DeinterlaceFilter,
      );
    expect(deinterlace?.filter).toBe('yadif=1');
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
        "mpeg2video",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mp2",
        "-filter_complex",
        "[0:0]yadif=1,hwupload_cuda,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,setsar=1,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
        "-map",
        "[v]",
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
        "-c:v",
        "h264_nvenc",
        "-rc-lookahead",
        "20",
        "-sc_threshold",
        "1000000000",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work with hardware filters disabled', () => {
    const capabilities = makeNvidiaCapabilities();
    const video = makeH264VideoInputNonSquare();
    const watermark = makeWatermark();

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      makePgsSubtitles(),
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(state, makeDesiredFrameState(video), {
      ...DefaultPipelineOptions,
      disableHardwareFilters: true,
    });

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
        "-init_hw_device",
        "cuda",
        "-hwaccel",
        "cuda",
        "-hwaccel_output_format",
        "cuda",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]hwdownload,format=cuda|nv12,pad=1920:1080:-1:-1:color=black,format=yuv420p[v];[0:5]format=yuva420p,scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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
        "-c:v",
        "h264_nvenc",
        "-rc-lookahead",
        "20",
        "-bsf:v",
        "h264_metadata=crop_bottom=8",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('updates pixel format for non-scaled input', () => {
    const capabilities = makeNvidiaCapabilities();
    const videoSource = new FileStreamSource('/path/to/video.mkv');
    const video = makeH264VideoInput();
    const watermark = makeWatermark();

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      makePgsSubtitles(videoSource),
    );

    const state = FfmpegState.create({
      version: ffmpegVersion,
      outputFormat: NullOutputFormat,
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        deinterlace: true,
      }),
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
        "-init_hw_device",
        "cuda",
        "-hwaccel",
        "cuda",
        "-hwaccel_output_format",
        "cuda",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]yadif_cuda,scale_cuda=iw*sar:ih,setsar=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v];[0:5]format=yuva420p,scale=1920:1080:force_original_aspect_ratio=decrease,hwupload_cuda[sub];[1:0]scale=192:-1,format=yuva420p[wm];[v][sub]overlay_cuda=x=(W-w)/2:y=(H-h)/2,hwdownload,format=yuv420p[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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
        "-c:v",
        "h264_nvenc",
        "-rc-lookahead",
        "20",
        "-c:a",
        "copy",
        "-f",
        "null",
        "pipe:1",
      ]
    `);
  });

  describe('HDR tonemapping', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test('uses LibplaceboTonemapFilter for HDR content with Vulkan and libplacebo capabilities', () => {
      vi.stubEnv(TUNARR_ENV_VARS.TONEMAP_ENABLED, 'true');
      vi.stubEnv(TUNARR_ENV_VARS.DISABLE_VULKAN, 'false');

      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      const tonemapFilter = out
        .getComplexFilter()
        ?.filterChain.videoFilterSteps.find(
          (step) => step instanceof LibplaceboTonemapFilter,
        );

      expect(tonemapFilter).toBeInstanceOf(LibplaceboTonemapFilter);
      expect(tonemapFilter?.filter).toContain('libplacebo=tonemapping=auto');
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
          "-init_hw_device",
          "cuda=nv",
          "-init_hw_device",
          "vulkan=vk@nv",
          "-hwaccel",
          "vulkan",
          "-hwaccel_output_format",
          "vulkan",
          "-readrate",
          "1",
          "-i",
          "/path/to/hdr-video.mkv",
          "-filter_complex",
          "[0:0]libplacebo=tonemapping=auto:colorspace=bt709:color_primaries=bt709:color_trc=bt709:format=nv12,hwupload_cuda,scale_cuda=iw*sar:ih,setsar=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('does not tonemap HDR content when Vulkan hwaccel is not available', () => {
      vi.stubEnv('TUNARR_DISABLE_VULKAN', 'true');

      const noVulkanCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(), // no vulkan
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        noVulkanCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      const tonemapFilter = out
        .getComplexFilter()
        ?.filterChain.videoFilterSteps.find(
          (step) => step instanceof LibplaceboTonemapFilter,
        );

      expect(tonemapFilter).toBeUndefined();
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
          "-init_hw_device",
          "cuda",
          "-hwaccel",
          "cuda",
          "-hwaccel_output_format",
          "cuda",
          "-readrate",
          "1",
          "-i",
          "/path/to/hdr-video.mkv",
          "-filter_complex",
          "[0:0]scale_cuda=format=p010le:passthrough=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,setsar=1,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('does not tonemap HDR content when libplacebo filter is not available', () => {
      vi.stubEnv('TUNARR_DISABLE_VULKAN', 'true');

      const noLibplaceboCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(), // no libplacebo
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        noLibplaceboCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      const tonemapFilter = out
        .getComplexFilter()
        ?.filterChain.videoFilterSteps.find(
          (step) => step instanceof LibplaceboTonemapFilter,
        );

      expect(tonemapFilter).toBeUndefined();
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
          "-init_hw_device",
          "cuda",
          "-hwaccel",
          "cuda",
          "-hwaccel_output_format",
          "cuda",
          "-readrate",
          "1",
          "-i",
          "/path/to/hdr-video.mkv",
          "-filter_complex",
          "[0:0]scale_cuda=format=p010le:passthrough=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,setsar=1,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('does not tonemap SDR content even with Vulkan and libplacebo capabilities', () => {
      vi.stubEnv('TUNARR_DISABLE_VULKAN', 'true');

      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = VideoInputSource.withStream(
        new FileStreamSource('/path/to/sdr-video.mkv'),
        VideoStream.create({
          codec: 'hevc',
          displayAspectRatio: '16:9',
          frameSize: FrameSize.FHD,
          index: 0,
          pixelFormat: new PixelFormatYuv420P(),
          providedSampleAspectRatio: null,
          colorFormat: ColorFormat.bt709,
        }),
      );

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        new FrameState({
          isAnamorphic: false,
          scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
          paddedSize: FrameSize.FHD,
          pixelFormat: new PixelFormatYuv420P(),
        }),
        DefaultPipelineOptions,
      );

      const tonemapFilter = out
        .getComplexFilter()
        ?.filterChain.videoFilterSteps.find(
          (step) => step instanceof LibplaceboTonemapFilter,
        );

      expect(tonemapFilter).toBeUndefined();
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
          "-init_hw_device",
          "cuda",
          "-hwaccel",
          "cuda",
          "-hwaccel_output_format",
          "cuda",
          "-readrate",
          "1",
          "-i",
          "/path/to/sdr-video.mkv",
          "-filter_complex",
          "[0:0]scale_cuda=iw*sar:ih,setsar=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('does not tonemap HDR content when TONEMAP_ENABLED is not set', () => {
      // No env var stubs - TONEMAP_ENABLED defaults to false
      // getBooleanEnvVar(TONEMAP_ENABLED, false) returns false → no tonemapping
      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      const tonemapFilter = out
        .getComplexFilter()
        ?.filterChain.videoFilterSteps.find(
          (step) => step instanceof LibplaceboTonemapFilter,
        );

      expect(tonemapFilter).toBeUndefined();
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
          "-init_hw_device",
          "cuda",
          "-hwaccel",
          "cuda",
          "-hwaccel_output_format",
          "cuda",
          "-readrate",
          "1",
          "-i",
          "/path/to/hdr-video.mkv",
          "-filter_complex",
          "[0:0]scale_cuda=format=p010le:passthrough=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,setsar=1,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('uses VulkanDecoder when tonemapping with HDR content', () => {
      vi.stubEnv(TUNARR_ENV_VARS.TONEMAP_ENABLED, 'true');
      vi.stubEnv(TUNARR_ENV_VARS.DISABLE_VULKAN, 'false');

      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      // Verify VulkanDecoder appears in command (hwaccel vulkan), not cuda
      const args = out.getCommandArgs().join(' ');
      expect(args).toContain('vulkan');
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
          "-init_hw_device",
          "cuda=nv",
          "-init_hw_device",
          "vulkan=vk@nv",
          "-hwaccel",
          "vulkan",
          "-hwaccel_output_format",
          "vulkan",
          "-readrate",
          "1",
          "-i",
          "/path/to/hdr-video.mkv",
          "-filter_complex",
          "[0:0]libplacebo=tonemapping=auto:colorspace=bt709:color_primaries=bt709:color_trc=bt709:format=nv12,hwupload_cuda,scale_cuda=iw*sar:ih,setsar=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });

    test('Bug 4: does not initialize Vulkan decoder when desiredState.pixelFormat is null', () => {
      vi.stubEnv(TUNARR_ENV_VARS.TONEMAP_ENABLED, 'true');
      vi.stubEnv(TUNARR_ENV_VARS.DISABLE_VULKAN, 'false');

      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        makeNvidiaCapabilities(),
        binaryCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const state = FfmpegState.create({ version: ffmpegVersion });

      // desiredState with null pixelFormat — the bug trigger:
      // needsTonemapWithVulkan becomes true → VulkanDecoder used,
      // but setTonemap() early-returns (line 808) leaving Vulkan init without any tonemap filter
      const desiredState = makeDesiredFrameState(video, { pixelFormat: null });

      const out = builder.build(state, desiredState, DefaultPipelineOptions);

      // After fix: no vulkan init args, ImplicitNvidiaDecoder (CUDA) used instead
      const args = out.getCommandArgs();
      expect(args.join(' ')).not.toContain('vulkan'); // fixed: no vulkan when pixelFormat is null
      expect(args.join(' ')).not.toContain('libplacebo'); // no tonemap filter (pixelFormat is null)
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
          "-init_hw_device",
          "cuda",
          "-hwaccel",
          "cuda",
          "-hwaccel_output_format",
          "cuda",
          "-readrate",
          "1",
          "-i",
          "/path/to/hdr-video.mkv",
          "-filter_complex",
          "[0:0]scale_cuda=format=p010le:passthrough=1,scale_cuda=1920:1080:force_original_aspect_ratio=decrease,setsar=1,hwdownload,format=p010le,format=yuv420p10le,pad=1920:1080:-1:-1:color=black,hwupload_cuda[v]",
          "-map",
          "[v]",
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
          "-c:v",
          "h264_nvenc",
          "-rc-lookahead",
          "20",
          "-c:a",
          "copy",
          "-f",
          "mpegts",
          "pipe:1",
        ]
      `);
    });
  });

  test('intermittent watermark, set format on hardware scale, do not set format on hwdownload', async () => {
    const capabilities = makeNvidiaCapabilities();
    const videoSource = new FileStreamSource('/path/to/video.mkv');
    const video = makeH264VideoInput720p();
    const watermark = makeWatermark();

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        deinterlace: false,
      }),
      DefaultPipelineOptions,
    );

    await new Promise((resolve, reject) => {
      LoggerFactory.root.flush((err) => {
        if (err) reject(err);
        resolve(void 0);
      });
    });

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
        "-init_hw_device",
        "cuda",
        "-hwaccel",
        "cuda",
        "-hwaccel_output_format",
        "cuda",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]scale_cuda=iw*sar:ih,setsar=1,scale_cuda=1920:1080:format=nv12:force_original_aspect_ratio=decrease,hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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
        "-c:v",
        "h264_nvenc",
        "-rc-lookahead",
        "20",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  describe('pixel format handling (Bug 5 - potential double hardware download)', () => {
    test('software encoder with watermark does not double-download when hardware decode is used', () => {
      // Bug 5: NvidiaPipelineBuilder.setPixelFormat() has two back-to-back conditional blocks
      // that can both add HardwareDownloadCudaFilter when watermark present + hw decode + sw encode.
      // The first block (lines 488-499): fires when encoderMode=None && watermark && Hardware
      // The second block (lines 501-522): fires when Hardware && encoderMode=None
      // Both conditions can be true simultaneously, potentially producing a double download.
      const capabilities = makeNvidiaCapabilities();
      const video = makeH264VideoInputNonSquare();
      const watermark = makeWatermark();

      const builder = new NvidiaPipelineBuilder(
        capabilities,
        EmptyFfmpegCapabilities,
        video,
        null,
        null,
        watermark,
        null,
      );

      const state = FfmpegState.create({ version: ffmpegVersion });

      const out = builder.build(state, makeDesiredFrameState(video), {
        ...DefaultPipelineOptions,
        disableHardwareEncoding: true,
      });

      // Document behavior: snapshot captures that double-download does NOT occur
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
          "-init_hw_device",
          "cuda",
          "-hwaccel",
          "cuda",
          "-hwaccel_output_format",
          "cuda",
          "-readrate",
          "1",
          "-i",
          "/path/to/video.mkv",
          "-i",
          "/path/to/watermark.jpg",
          "-filter_complex",
          "[0:0]hwdownload,format=nv12,format=yuv420p,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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

      // Explicit guard: verify exactly one hwdownload (not two)
      const filterComplex = out
        .getCommandArgs()
        .find((arg) => arg.startsWith('['));
      expect(filterComplex).not.toMatch(/hwdownload.*hwdownload/);
      expect(filterComplex?.match(/hwdownload/g)?.length).toBe(1);
    });
  });
});
