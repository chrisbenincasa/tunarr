import { TONEMAP_ENABLED, TUNARR_ENV_VARS } from '@/util/env.js';
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
        colorFormat: null,
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
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
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
        colorFormat: null,
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
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
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
        colorFormat: null,
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
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
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
        colorFormat: null,
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
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
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
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });
});

describe('VaapiPipelineBuilder pad', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  const fakeVersion = {
    versionString: 'n7.0.2',
    majorVersion: 7,
    minorVersion: 0,
    patchVersion: 2,
    isUnknown: false,
  };

  // 4:3 video that needs pillarboxing to fit in 16:9 FHD:
  // squarePixelFrameSize(FHD) = 1440x1080, paddedSize = 1920x1080
  function create43VideoStream(): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'h264',
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.withDimensions(640, 480),
      displayAspectRatio: '4:3',
      providedSampleAspectRatio: null,
      colorFormat: null,
    });
  }

  function buildWithPad(opts: {
    videoStream: VideoStream;
    binaryCapabilities?: FfmpegCapabilities;
    disableHardwareDecoding?: boolean;
    disableHardwareEncoding?: boolean;
  }) {
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

    const binaryCapabilities =
      opts.binaryCapabilities ??
      new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.PadVaapi]),
        new Set(),
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
    const videoStream = video.streams[0]!;

    return builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: videoStream.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      {
        ...DefaultPipelineOptions,
        vaapiDevice: '/dev/dri/renderD128',
        disableHardwareDecoding: opts.disableHardwareDecoding ?? false,
        disableHardwareEncoding: opts.disableHardwareEncoding ?? false,
      },
    );
  }

  test('uses pad_vaapi when capability is available and content is SDR', () => {
    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi=w=1920:h=1080');
    expect(args).not.toContain('pad=1920');
  });

  test('falls back to software pad when pad_vaapi capability is not available', () => {
    const pipeline = buildWithPad({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('pad=1920:1080');
  });

  test('uses software pad for HDR content even when pad_vaapi capability is available', () => {
    const hdrStream = VideoStream.create({
      index: 0,
      codec: 'h264',
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.withDimensions(640, 480),
      displayAspectRatio: '4:3',
      providedSampleAspectRatio: null,
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithPad({ videoStream: hdrStream });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('pad=1920:1080');
  });

  test('pad_vaapi includes hwupload when frame data is in software', () => {
    const pipeline = buildWithPad({
      videoStream: create43VideoStream(),
      disableHardwareDecoding: true,
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi');
    const hwuploadIndex = args.indexOf('hwupload');
    const padVaapiIndex = args.indexOf('pad_vaapi');
    expect(hwuploadIndex).toBeGreaterThan(-1);
    expect(hwuploadIndex).toBeLessThan(padVaapiIndex);
  });

  test('falls back to software pad when TUNARR_DISABLE_VAAPI_PAD=true, even when pad_vaapi is available', () => {
    process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'true';

    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('pad=1920:1080');
  });

  test('falls back to software pad when TUNARR_DISABLE_VAAPI_PAD=true and only pad_opencl is available', () => {
    process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'true';

    const pipeline = buildWithPad({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.PadOpencl]),
        new Set(),
      ),
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_opencl');
    expect(args).toContain('pad=1920:1080');
  });

  test('uses pad_vaapi when TUNARR_DISABLE_VAAPI_PAD is not set', () => {
    delete process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD];

    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi=w=1920:h=1080');
  });

  test('uses pad_vaapi when TUNARR_DISABLE_VAAPI_PAD=false', () => {
    process.env[TUNARR_ENV_VARS.DISABLE_VAAPI_PAD] = 'false';

    const pipeline = buildWithPad({ videoStream: create43VideoStream() });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('pad_vaapi=w=1920:h=1080');
    expect(args).not.toContain('pad=1920:1080');
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
        new Set(),
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

  function hasSoftwareTonemapFilter(
    pipeline: ReturnType<typeof buildWithTonemap>,
  ) {
    const args = pipeline.getCommandArgs().join(' ');
    return args.includes('zscale') && args.includes('tonemap=tonemap=hable');
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

  test('falls back to software tonemap when neither tonemap_vaapi nor tonemap_opencl is available', () => {
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
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('skips hardware tonemap but applies software tonemap when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      disableHardwareFilters: true,
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
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

  test('skips opencl tonemap when hardware filters are disabled but applies software tonemap', () => {
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
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('applies tonemap_vaapi for Dolby Vision content (dvhe codec)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const dvStream = VideoStream.create({
      index: 0,
      codec: 'dvhe',
      profile: 'dvhe.08.09',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({ videoStream: dvStream });

    expect(hasTonemapFilter(pipeline)).to.eq(true);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
  });

  test('applies software tonemap for Dolby Vision (dvhe codec) when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const dvStream = VideoStream.create({
      index: 0,
      codec: 'dvhe',
      profile: 'dvhe.08.09',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: dvStream,
      disableHardwareFilters: true,
    });

    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('applies software tonemap for Dolby Vision with profile string (hevc codec)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const dvStream = VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'dolby vision / hevc main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.FourK,
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: new ColorFormat({
        colorRange: ColorRanges.Tv,
        colorSpace: ColorSpaces.Bt2020nc,
        colorPrimaries: ColorPrimaries.Bt2020,
        colorTransfer: ColorTransferFormats.Smpte2084,
      }),
    });

    const pipeline = buildWithTonemap({
      videoStream: dvStream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    // No hardware tonemap filter, falls back to software
    expect(hasTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });
});
