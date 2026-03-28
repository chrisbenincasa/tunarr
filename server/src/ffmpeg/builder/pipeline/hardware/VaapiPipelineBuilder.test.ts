import { ColorFormat } from '@/ffmpeg/builder/format/ColorFormat.js';
import { TONEMAP_ENABLED, TUNARR_ENV_VARS } from '@/util/env.js';
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
  AudioFormats,
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
  VideoFormats,
} from '../../constants.ts';
import { PadFilter } from '../../filter/PadFilter.ts';
import { ScaleFilter } from '../../filter/ScaleFilter.ts';
import { PadVaapiFilter } from '../../filter/vaapi/PadVaapiFilter.ts';
import { ScaleVaapiFilter } from '../../filter/vaapi/ScaleVaapiFilter.ts';
import { TonemapVaapiFilter } from '../../filter/vaapi/TonemapVaapiFilter.ts';
import {
  PixelFormatRgba,
  PixelFormatUnknown,
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
import {
  AudioInputFilterSource,
  AudioInputSource,
} from '../../input/AudioInputSource.ts';
import { LavfiVideoInputSource } from '../../input/LavfiVideoInputSource.ts';
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
  PipelineOptions,
} from '../../state/FfmpegState.ts';
import { FrameState, FrameStateOpts } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { Pipeline } from '../Pipeline.ts';
import { VaapiPipelineBuilder } from './VaapiPipelineBuilder.ts';

// ─── Shared helpers ─────────────────────────────────────────────────────────

const fakeVersion = {
  versionString: 'n7.0.2',
  majorVersion: 7,
  minorVersion: 0,
  patchVersion: 2,
  isUnknown: false,
};

// 16:9 FHD: squarePixelFrameSize(FHD) = 1920x1080 = paddedSize → no scale, no pad needed
function create169FhdVideoStream(): VideoStream {
  return VideoStream.create({
    index: 0,
    codec: 'h264',
    profile: 'main',
    pixelFormat: new PixelFormatYuv420P(),
    frameSize: FrameSize.FHD,
    displayAspectRatio: '16:9',
    providedSampleAspectRatio: '1:1',
    colorFormat: null,
  });
}

// 4:3 640x480: squarePixelFrameSize(FHD) = 1440x1080, paddedSize = 1920x1080
// scale IS needed (640 != 1440), padding IS needed (1440 != 1920)
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

// ─── Shared env-var save/restore (applied to all describe blocks) ────────────

const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv };
});

afterEach(() => {
  process.env = originalEnv;
});

// ─────────────────────────────────────────────────────────────────────────────

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
  // 4:3 video needs pillarboxing: squarePixelFrameSize(FHD) = 1440x1080, paddedSize = 1920x1080

  function buildWithPad(opts: {
    videoStream: VideoStream;
    binaryCapabilities?: FfmpegCapabilities;
    disableHardwareDecoding?: boolean;
    disableHardwareEncoding?: boolean;
    watermarkStream?: StillImageStream;
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

    let wm: WatermarkInputSource | null = null;
    if (opts.watermarkStream) {
      wm = new WatermarkInputSource(
        new FileStreamSource('/path/to/watermark.png'),
        opts.watermarkStream,
        {
          duration: 0,
          enabled: true,
          horizontalMargin: 0,
          opacity: 1,
          position: 'top-left',
          verticalMargin: 0,
          width: 100,
        },
      );
    }

    const builder = new VaapiPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      wm,
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

  test('skips pad filter when current paddedSize already equals desired paddedSize (pad_vaapi available)', () => {
    // 16:9 FHD source fills the target frame exactly — no padding needed
    const pipeline = buildWithPad({ videoStream: create169FhdVideoStream() });

    const videoFilters =
      pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(videoFilters.some((f) => f instanceof PadVaapiFilter)).toBe(false);
    expect(videoFilters.some((f) => f instanceof PadFilter)).toBe(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).not.toContain('pad=');
  });

  test('skips pad filter when current paddedSize already equals desired paddedSize (no pad_vaapi capability)', () => {
    const pipeline = buildWithPad({
      videoStream: create169FhdVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(),
        new Set(),
      ),
    });

    const videoFilters =
      pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(videoFilters.some((f) => f instanceof PadVaapiFilter)).toBe(false);
    expect(videoFilters.some((f) => f instanceof PadFilter)).toBe(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).not.toContain('pad=');
  });

  test('skips pad filter when current paddedSize already equals desired paddedSize (hardware decoding disabled)', () => {
    const pipeline = buildWithPad({
      videoStream: create169FhdVideoStream(),
      disableHardwareDecoding: true,
    });

    const videoFilters =
      pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(videoFilters.some((f) => f instanceof PadVaapiFilter)).toBe(false);
    expect(videoFilters.some((f) => f instanceof PadFilter)).toBe(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).not.toContain('pad_vaapi');
    expect(args).not.toContain('pad=');
  });

  test('hardware download after pad_vaapi with watermark', () => {
    const pipeline = buildWithPad({
      videoStream: VideoStream.create({
        index: 0,
        codec: VideoFormats.Mpeg4,
        // profile: 'main',
        pixelFormat: new PixelFormatYuv420P(),
        frameSize: FrameSize.withDimensions(1920, 1050),
        displayAspectRatio: '4:3',
        providedSampleAspectRatio: null,
        colorFormat: null,
      }),
      watermarkStream: StillImageStream.create({
        frameSize: FrameSize.withDimensions(100, 100),
        index: 0,
      }),
    });

    const args = pipeline.getCommandArgs().join(' ');
    // pad_vaapi must be present
    expect(args).toContain('pad_vaapi');
    // hwdownload must appear after pad_vaapi (before the software overlay)
    expect(args).toContain('hwdownload');
    const padIdx = args.indexOf('pad_vaapi');
    const dlIdx = args.indexOf('hwdownload');
    expect(dlIdx).toBeGreaterThan(padIdx);
    // any second hwupload (to re-enter hw for encoding) must come AFTER hwdownload
    const secondHwuploadIdx = args.indexOf('hwupload', dlIdx);
    if (secondHwuploadIdx !== -1) {
      expect(secondHwuploadIdx).toBeGreaterThan(dlIdx);
    }
  });
});

describe('VaapiPipelineBuilder tonemap', () => {
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
    pipelineOptions?: Partial<PipelineOptions>;
    desiredState?: Partial<FrameStateOpts>;
  }): Pipeline {
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
        new Set([KnownFfmpegFilters.TonemapOpencl]),
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

    const desiredState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
      pixelFormat: new PixelFormatYuv420P(),
      videoFormat: VideoFormats.Hevc,
      ...(opts.desiredState ?? {}),
    });

    const pipeline = builder.build(state, desiredState, {
      ...DefaultPipelineOptions,
      ...(opts.pipelineOptions ?? {}),
      vaapiDevice: '/dev/dri/renderD128',
      vaapiPipelineOptions: {
        tonemapPreference: 'opencl',
        ...(opts.pipelineOptions?.vaapiPipelineOptions ?? {}),
      },
    });

    return pipeline;
  }

  function hasVaapiTonemapFilter(pipeline: Pipeline) {
    const filterChain =
      pipeline.getComplexFilter()?.filterChain.videoFilterSteps ?? [];
    return filterChain.some((filter) => filter instanceof TonemapVaapiFilter);
  }

  function hasOpenclTonemapFilter(pipeline: Pipeline) {
    const args = pipeline.getCommandArgs().join(' ');
    return args.includes('tonemap_opencl');
  }

  function hasSoftwareTonemapFilter(pipeline: Pipeline) {
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

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain('tonemap_opencl=tonemap=hable');
    expect(args).toContain('hwmap=derive_device=opencl');
    expect(args).toContain('hwmap=derive_device=vaapi:reverse=1');
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

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
  });

  test('skips tonemap when TONEMAP_ENABLED is false', () => {
    process.env[TONEMAP_ENABLED] = 'false';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
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

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
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

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('skips hardware tonemap but applies software tonemap when hardware filters are disabled', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      pipelineOptions: {
        disableHardwareFilters: true,
      },
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('tonemap filter appears before scale in the filter chain', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
    });

    const args = pipeline.getCommandArgs().join(' ');
    console.log(args);
    const tonemapIndex = args.indexOf('tonemap_opencl');
    // buildWithTonemap sets scaledSize=FHD=paddedSize, but frames are on hardware after tonemap
    // → scale_vaapi is used (frames stay on hardware)
    const scaleIndex = args.indexOf('scale_vaapi=');

    expect(tonemapIndex).toBeGreaterThan(-1);
    expect(scaleIndex).toBeGreaterThan(-1);
    expect(tonemapIndex).toBeLessThan(scaleIndex);
  });

  test('uses tonemap_vaapi when preference is explicitly vaapi and opencl is unavailable', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(true);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(args).toContain('tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709');
  });

  test('prefers tonemap_opencl over tonemap_vaapi when both are available', () => {
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

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
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
    console.log(args);
    const tonemapIndex = args.indexOf('tonemap_opencl');
    // buildWithTonemap sets scaledSize=FHD=paddedSize, but frames are on hardware after tonemap
    // → scale_vaapi is used (frames stay on hardware)
    const scaleIndex = args.indexOf('scale_vaapi=');

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
      pipelineOptions: {
        disableHardwareFilters: true,
      },
    });

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('applies tonemap_opencl for Dolby Vision content (dvhe codec)', () => {
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

    expect(hasOpenclTonemapFilter(pipeline)).to.eq(true);
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
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
      pipelineOptions: {
        disableHardwareFilters: true,
      },
    });

    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
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
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(false);
    expect(hasOpenclTonemapFilter(pipeline)).to.eq(false);
    expect(hasSoftwareTonemapFilter(pipeline)).to.eq(true);
  });

  test('yuv420p10le input ensures outputted pixel format is 8-bit nv12', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
      frameSize: FrameSize.withDimensions(3840, 2076),
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
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
      desiredState: {
        scaledSize: stream.squarePixelFrameSize(FrameSize.FourK),
        paddedSize: FrameSize.FourK,
      },
    });

    const padFilter = pipeline
      .getComplexFilter()!
      .filterChain.videoFilterSteps.find((step) => step instanceof PadFilter);
    console.log(pipeline.getCommandArgs().join(' '));
    expect(padFilter).toBeDefined();
    expect(padFilter!.filter).toEqual(
      'hwdownload,format=nv12,pad=3840:2160:-1:-1:color=black',
    );
  });

  test('unknown pixel format properly wraps in nv12 after tonemapping', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      pixelFormat: PixelFormatUnknown(10),
      frameSize: FrameSize.withDimensions(3840, 2076),
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
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
      desiredState: {
        scaledSize: stream.squarePixelFrameSize(FrameSize.FourK),
        paddedSize: FrameSize.FourK,
      },
    });

    const padFilter = pipeline
      .getComplexFilter()!
      .filterChain.videoFilterSteps.find((step) => step instanceof PadFilter);
    expect(padFilter).toBeDefined();
    expect(padFilter!.filter).toEqual(
      'hwdownload,format=nv12,pad=3840:2160:-1:-1:color=black',
    );
  });

  test('tonemap_vaapi includes format upload prefix when frame data is in software (hardware decoding disabled)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithTonemap({
      videoStream: createHdrVideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        disableHardwareDecoding: true,
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const args = pipeline.getCommandArgs().join(' ');
    expect(args).toContain(
      'format=vaapi|nv12|p010le,tonemap_vaapi=format=nv12:t=bt709:m=bt709:p=bt709',
    );
  });

  // After tonemap uploads frames to hardware, condition 2 (decoder!=VAAPI && frames on Hardware)
  // triggers software scale — frames are downloaded from hardware before the software scale.
  test('8-bit yuv420p HDR input uses vaapi tonemap and software scale (software decode)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    // Unusual but valid: 8-bit stream tagged with HDR color metadata
    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      // Explicitly trigger a software decode
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
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
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const args = pipeline.getCommandArgs().join(' ');
    console.log(args);
    const filters = pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(true);
    // decoder=None, tonemap uploads to hardware → condition 2 fires → ScaleFilter (software scale)
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(false);
    // Frames come from hardware → ScaleFilter inserts hwdownload
    expect(args).toContain('hwdownload');
    expect(args).toContain('scale=');
  });

  test('8-bit yuv420p HDR input uses vaapi tonemap and hardware scale (hardware decode)', () => {
    process.env[TONEMAP_ENABLED] = 'true';

    // Unusual but valid: 8-bit stream tagged with HDR color metadata
    const stream = VideoStream.create({
      index: 0,
      codec: VideoFormats.Hevc,
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P(),
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
      videoStream: stream,
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      pipelineOptions: {
        vaapiPipelineOptions: { tonemapPreference: 'vaapi' },
      },
    });

    const args = pipeline.getCommandArgs().join(' ');
    console.log(args);
    const filters = pipeline.getComplexFilter()!.filterChain.videoFilterSteps;
    expect(hasVaapiTonemapFilter(pipeline)).to.eq(true);
    // Frames on hardware after tonemap → scale_vaapi is used (frames stay on hardware)
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    expect(args).toContain('scale_vaapi=');
    expect(args).not.toContain('scale=');
  });

  describe('still image stream', () => {
    test('correct produces pipeline for error image', () => {
      const stream = StillImageStream.create({
        index: 0,
        pixelFormat: PixelFormatUnknown(8),
        frameSize: FrameSize.FourK,
      });

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

      const audioState = AudioState.create({
        audioEncoder: AudioFormats.Ac3,
        audioChannels: 6,
        audioBitrate: 192,
        audioBufferSize: 384,
        audioSampleRate: 48,
        audioVolume: 100,
        // Check if audio and video are coming from same location
        // audioDuration: duration.asMilliseconds(),
      });

      const pipeline = new VaapiPipelineBuilder(
        capabilities,
        EmptyFfmpegCapabilities,
        // VideoInputSource.withStream(
        //   new HttpStreamSource(
        //     'http://localhost:8000/images/generic-error-screen.png',
        //   ),
        //   stream,
        // ),
        LavfiVideoInputSource.errorText(
          FrameSize.FHD,
          'Error',
          'There was an error',
        ),
        AudioInputFilterSource.noise(audioState),
        null,
        null,
        null,
      );

      const builtPipeline = pipeline.build(
        FfmpegState.create({
          version: {
            versionString: 'n7.1.1-56-gc2184b65d2-20250716',
            majorVersion: 7,
            minorVersion: 1,
            patchVersion: 1,
            versionDetails: '56-gc2184b65d2-20250716',
            isUnknown: false,
          },
          vaapiDevice: '/dev/dri/renderD128',
        }),
        new FrameState({
          scaledSize: stream.squarePixelFrameSize(FrameSize.FHD),
          paddedSize: FrameSize.FourK,
          isAnamorphic: false,
          realtime: true,
          videoFormat: VideoFormats.H264,
          frameRate: 24,
          videoTrackTimescale: 90000,
          videoBitrate: 4_000,
          videoBufferSize: 8_000,
          deinterlace: false,
          pixelFormat: new PixelFormatYuv420P(),
          colorFormat: ColorFormat.unknown,
          infiniteLoop: false,
        }),
        DefaultPipelineOptions,
      );

      console.log(builtPipeline.getCommandArgs().join(' '));
    });
  });
});

describe('VaapiPipelineBuilder scale', () => {
  // 16:9 1280x720 — squarePixelFrameSize(FHD) = 1920x1080 = paddedSize
  // willNeedPad = false, scale IS needed (1280 != 1920)
  function create169VideoStream(): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'h264',
      profile: 'main',
      pixelFormat: new PixelFormatYuv420P(),
      frameSize: FrameSize.withDimensions(1280, 720),
      displayAspectRatio: '16:9',
      providedSampleAspectRatio: '1:1',
      colorFormat: null,
    });
  }

  // 4:3 HDR HEVC stream — squarePixelFrameSize(FHD) = 1440x1080, paddedSize = 1920x1080
  // willNeedPad = true, scale is needed; HDR triggers tonemap when TONEMAP_ENABLED=true
  function createHdr43VideoStream(): VideoStream {
    return VideoStream.create({
      index: 0,
      codec: 'hevc',
      profile: 'main 10',
      pixelFormat: new PixelFormatYuv420P10Le(),
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
  }

  function buildWithScale(opts: {
    videoStream: VideoStream;
    binaryCapabilities?: FfmpegCapabilities;
    disableHardwareDecoding?: boolean;
    disableHardwareEncoding?: boolean;
    disableHardwareFilters?: boolean;
    deinterlace?: boolean;
  }): Pipeline {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
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
        videoFormat: VideoFormats.H264,
        deinterlace: opts.deinterlace ?? false,
      }),
      {
        ...DefaultPipelineOptions,
        vaapiDevice: '/dev/dri/renderD128',
        disableHardwareDecoding: opts.disableHardwareDecoding ?? false,
        disableHardwareEncoding: opts.disableHardwareEncoding ?? false,
        disableHardwareFilters: opts.disableHardwareFilters ?? false,
      },
    );
  }

  function getVideoFilterSteps(pipeline: Pipeline) {
    return pipeline.getComplexFilter()?.filterChain.videoFilterSteps ?? [];
  }

  // ─── Baseline: hardware scale ────────────────────────────────────────────────

  test('uses scale_vaapi when VAAPI decode+encode, padding is needed, and hw pad is available', () => {
    // Baseline: all conditions for software scale are false → hardware scale
    const pipeline = buildWithScale({ videoStream: create43VideoStream() });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale baseline (hardware):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    expect(args).toContain('scale_vaapi=');
    expect(args).not.toContain('scale=');
  });

  // ─── Condition 1: both decode and encode are None, no deinterlace ─────────────

  test('uses software scale when both hardware decode and encode are disabled (no deinterlace)', () => {
    // decoderMode=None, encoderMode=None, !shouldDeinterlace → condition 1 true → software scale
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(),
      disableHardwareDecoding: true,
      disableHardwareEncoding: true,
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale sw (both disabled, no deinterlace):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(false);
    expect(args).toContain('scale='); // 'scale=' without the vaapi suffix
    expect(args).not.toContain('scale_vaapi=');
  });

  test('uses hardware scale when both decode and encode are disabled but deinterlace is requested', () => {
    // decoderMode=None, encoderMode=None, shouldDeinterlace=true → condition 1 is false
    // All other conditions are also false (padding needed, hw pad available, hw filters enabled)
    // → hardware scale; ScaleVaapiFilter prepends format+hwupload since frames are in software
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(),
      disableHardwareDecoding: true,
      disableHardwareEncoding: true,
      deinterlace: true,
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale hw (both disabled + deinterlace):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    // Software frames → ScaleVaapiFilter prepends format+hwupload before scale_vaapi
    expect(args).toContain('hwupload');
    expect(args).toContain('scale_vaapi=');
  });

  // ─── Condition 2: decoder != VAAPI, frame data location decides ──────────────

  test('uses hardware scale when decode is disabled and frames remain in software (no tonemap, padding needed)', () => {
    // decoderMode=None (decode disabled), frames in Software (no tonemap runs)
    // Condition 2: decoder!=VAAPI (true) && frameDataLocation==Hardware (FALSE) → false
    // Old code would software scale here: decoder!=VAAPI && !shouldPerformTonemap && canTonemapOnHardware
    // New code correctly uses hardware scale since frames are not on hardware
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(), // SDR, no tonemap triggered
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        // Has TonemapVaapi (so old condition canTonemapOnHardware=true would fire),
        // but TONEMAP_ENABLED is false so no tonemap actually runs
        new Set([KnownFfmpegFilters.PadVaapi, KnownFfmpegFilters.TonemapVaapi]),
        new Set(),
      ),
      disableHardwareDecoding: true,
      // TONEMAP_ENABLED not set → frames stay in Software
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale hw (decode disabled, frames in sw, no tonemap):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    // Frames are in Software → ScaleVaapiFilter adds format+hwupload prefix
    expect(args).toContain('hwupload');
    expect(args).toContain('scale_vaapi=');
    expect(args).not.toContain('scale=');
  });

  test('uses software scale when decode is disabled but tonemap uploads frames to hardware', () => {
    // decoderMode=None (decode disabled), tonemap runs and uploads frames to Hardware
    // Condition 2: decoder!=VAAPI (true) && frameDataLocation==Hardware (TRUE after tonemap) → software scale
    process.env[TONEMAP_ENABLED] = 'true';

    const pipeline = buildWithScale({
      videoStream: createHdr43VideoStream(), // HDR + 4:3 → tonemap runs, padding needed
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        // TonemapOpencl matches default vaapiPipelineOptions.tonemapPreference='opencl'
        new Set([
          KnownFfmpegFilters.PadVaapi,
          KnownFfmpegFilters.TonemapOpencl,
        ]),
        new Set(),
      ),
      disableHardwareDecoding: true,
      // After TonemapOpenclFilter.nextState: frameDataLocation = Hardware
      // → condition 2 fires → software scale
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale sw (decode disabled, frames on hw via tonemap):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(false);
    // Frames came from hardware (tonemap) → ScaleFilter adds hwdownload before software scale
    expect(args).toContain('hwdownload');
    expect(args).toContain('scale=');
    expect(args).not.toContain('scale_vaapi=');
  });

  // ─── Condition 3: !willNeedPad — scaledSize equals paddedSize ────────────────

  test('uses hardware scale even when no padding is needed (16:9 source, hw decode → frames on hardware)', () => {
    // 1280x720 16:9 → squarePixelFrameSize(FHD) = 1920x1080 = paddedSize → !willNeedPad = true
    // But hw decode puts frames on hardware → condition 3 does NOT fire → scale_vaapi
    const pipeline = buildWithScale({ videoStream: create169VideoStream() });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale hw (!willNeedPad but frames on hw):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    expect(args).toContain('scale_vaapi=');
    expect(args).not.toContain('scale=');
  });

  // ─── Condition 4: !canPadOnHardware — no hardware pad filter available ────────

  test('uses hardware scale when hw pad capability is not available (hw decode → frames on hardware; pad will hwdownload)', () => {
    // 4:3 → needs padding; no PadVaapi/PadOpencl → canPadOnHardware=false
    // But hw decode puts frames on hardware → !canPadOnHardware alone does NOT force sw scale
    // scale_vaapi runs first; PadFilter then auto-prepends hwdownload before software pad
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set(), // no pad_vaapi, no pad_opencl
        new Set(),
      ),
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale hw (!canPadOnHardware but frames on hw):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    expect(args).toContain('scale_vaapi=');
    expect(args).not.toContain('scale=');
  });

  test('uses hardware scale when only pad_opencl is available (not pad_vaapi)', () => {
    // pad_opencl satisfies canPadOnHardware → hardware scale
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.PadOpencl]),
        new Set(),
      ),
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale hw (pad_opencl satisfies canPadOnHardware):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    expect(args).toContain('scale_vaapi=');
  });

  // ─── Condition 5: disableHardwareFilters ─────────────────────────────────────

  test('uses software scale when hardware filters are disabled', () => {
    // disableHardwareFilters → condition 5 fires → software scale
    // Also makes canPadOnHardware=false, but condition 5 fires first
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(),
      disableHardwareFilters: true,
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale sw (disableHardwareFilters):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(false);
    expect(args).toContain('scale=');
    expect(args).not.toContain('scale_vaapi=');
  });

  test('disableHardwareFilters overrides available pad_vaapi capability and forces software scale', () => {
    // Even with pad_vaapi available, disableHardwareFilters forces software path
    const pipeline = buildWithScale({
      videoStream: create43VideoStream(),
      binaryCapabilities: new FfmpegCapabilities(
        new Set(),
        new Map(),
        new Set([KnownFfmpegFilters.PadVaapi]),
        new Set(),
      ),
      disableHardwareFilters: true,
    });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale sw (disableHardwareFilters overrides pad_vaapi):', args);

    expect(args).not.toContain('scale_vaapi=');
    expect(args).not.toContain('pad_vaapi');
    expect(args).toContain('scale=');
  });

  // ─── Regression: HDR content with TONEMAP_ENABLED=false ─────────────────────

  test('uses hardware scale for HDR content when TONEMAP_ENABLED is false (regression)', () => {
    // Regression: HDR content with TONEMAP_ENABLED=false caused software scale because
    // canPadOnHardware() returns false for HDR, and !canPadOnHardware was incorrectly
    // forcing software scale regardless of frame location. With hw decode active, frames
    // are on hardware → scale_vaapi should be used.
    process.env[TONEMAP_ENABLED] = 'false';

    const pipeline = buildWithScale({ videoStream: createHdr43VideoStream() });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('scale hw (HDR, TONEMAP_ENABLED=false, regression):', args);

    const filters = getVideoFilterSteps(pipeline);
    expect(filters.some((f) => f instanceof ScaleVaapiFilter)).toBe(true);
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    expect(args).toContain('scale_vaapi=');
    expect(args).not.toContain('scale=');
  });

  // ─── No scale needed ─────────────────────────────────────────────────────────

  test('produces no resize when source already matches desired scaled size', () => {
    // 1920x1080 FHD source → currentState.scaledSize == desiredState.scaledSize
    // setScale creates a ScaleVaapiFilter only for pixel format conversion (not resize).
    // ScaleVaapiFilter with matching sizes outputs 'scale_vaapi=format=...' without dimensions.
    const pipeline = buildWithScale({ videoStream: create169FhdVideoStream() });
    const args = pipeline.getCommandArgs().join(' ');
    console.log('no resize (sizes already match):', args);

    const filters = getVideoFilterSteps(pipeline);
    // No software resize
    expect(filters.some((f) => f instanceof ScaleFilter)).toBe(false);
    // scale_vaapi with an actual resize includes 'force_divisible_by'; format-only does not
    expect(args).not.toContain('force_divisible_by');
    expect(args).not.toContain('scale=');
  });
});
