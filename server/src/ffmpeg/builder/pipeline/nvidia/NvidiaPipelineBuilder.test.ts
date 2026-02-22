import { FileStreamSource } from '../../../../stream/types.ts';
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

describe('NvidiaPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = new NvidiaHardwareCapabilities('RTX 2080 Ti', 75);
    const video = VideoInputSource.withStream(
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

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      }),
      DefaultPipelineOptions,
    );

    const thread = out.steps.find((step) => step instanceof ThreadCountOption);
    expect(thread).toBeInstanceOf(ThreadCountOption);
    expect(thread?.options()).toEqual(['-threads', '1']);
    console.log(out.getCommandArgs().join(' '));
  });

  test('should work software decode', () => {
    const capabilities = new NvidiaHardwareCapabilities('RTX 2080 Ti', 75);
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
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
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
  });

  test('should work with hardware filters disabled', () => {
    const capabilities = new NvidiaHardwareCapabilities('RTX 2080 Ti', 75);
    const video = VideoInputSource.withStream(
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

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      }),
      {
        ...DefaultPipelineOptions,
        disableHardwareFilters: true,
      },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('updates pixel format for non-scaled input', () => {
    const capabilities = new NvidiaHardwareCapabilities('RTX 2080 Ti', 75);

    const videoSource = new FileStreamSource('/path/to/video.mkv');

    const video = VideoInputSource.withStream(
      videoSource,
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.FHD,
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: ColorFormat.unknown,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      new SubtitlesInputSource(
        videoSource,
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
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

    console.log(out.getCommandArgs().join(' '));
  });

  describe('HDR tonemapping', () => {
    const hdrColorFormat = new ColorFormat({
      colorRange: ColorRanges.Tv,
      colorSpace: ColorSpaces.Bt2020nc,
      colorTransfer: ColorTransferFormats.Smpte2084,
      colorPrimaries: ColorPrimaries.Bt2020,
    });

    const capabilities = new NvidiaHardwareCapabilities('RTX 2080 Ti', 75);

    const ffmpegVersion = {
      versionString: 'n7.0.2-15-g0458a86656-20240904',
      majorVersion: 7,
      minorVersion: 0,
      patchVersion: 2,
      isUnknown: false,
    } as const;

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

    function makeDesiredFrameState(video: VideoInputSource) {
      return new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      });
    }

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test('uses LibplaceboTonemapFilter for HDR content with Vulkan and libplacebo capabilities', () => {
      vi.stubEnv('TUNARR_DISABLE_VULKAN', 'true');

      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        capabilities,
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
        capabilities,
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
        capabilities,
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
        capabilities,
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
    });

    test('does not tonemap HDR content when TUNARR_DISABLE_VULKAN is not set', () => {
      const binaryCapabilities = new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(['libplacebo']),
        new Set(['vulkan']),
      );
      const video = makeHdrVideoInput();

      const builder = new NvidiaPipelineBuilder(
        capabilities,
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
    });
  });

  test('intermittent watermark, set format on hardware scale, do not set format on hwdownload', async () => {
    const capabilities = new NvidiaHardwareCapabilities('RTX 2080 Ti', 75);

    const videoSource = new FileStreamSource('/path/to/video.mkv');

    const video = VideoInputSource.withStream(
      videoSource,
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

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new NvidiaPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

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

    console.log(out.getCommandArgs().join(' '));
  });
});
