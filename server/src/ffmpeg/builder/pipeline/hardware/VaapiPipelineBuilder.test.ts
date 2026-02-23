import { TONEMAP_ENABLED } from '@/util/env.js';
import { FileStreamSource } from '../../../../stream/types.ts';
import { FfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
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
import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';

describe('VaapiPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = new VaapiHardwareCapabilities([]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
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

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
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
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      }),
      DefaultPipelineOptions,
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, decoding disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
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

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
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
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareDecoding: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, encoding disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 0,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      // new SubtitlesInputSource(
      //   new FileStreamSource('/path/to/video.mkv'),
      //   [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
      //   SubtitleMethods.Burn,
      // ),
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
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareEncoding: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, filters disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
    );
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
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

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
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
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('basic audio-only stream', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const binaryCapabilities = new FfmpegCapabilities(
      new Set(),
      new Map(),
      new Set(),
    );

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
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    console.log(out.getCommandArgs().join(' '));
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
  });

  test('skips tonemap when TONEMAP_ENABLED is false', () => {
    process.env[TONEMAP_ENABLED] = 'false';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
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
  });

  test('skips tonemap when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      disableHardwareFilters: true,
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
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
  });
});
