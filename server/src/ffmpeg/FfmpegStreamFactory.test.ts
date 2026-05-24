import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.ts';
import type {
  ISettingsDB,
  ReadableFfmpegSettings,
} from '@/db/interfaces/ISettingsDB.ts';
import type { ChannelOrm } from '@/db/schema/Channel.ts';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.ts';
import {
  AudioFormats,
  HlsDirectOutputFormat,
  MpegTsOutputFormat,
  VideoFormats,
  VideoPresets,
  defaultHlsOptions,
} from '@/ffmpeg/builder/constants.ts';
import type { PipelineBuilder } from '@/ffmpeg/builder/pipeline/PipelineBuilder.ts';
import type { PipelineBuilderFactory } from '@/ffmpeg/builder/pipeline/PipelineBuilderFactory.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import { FfmpegState } from '@/ffmpeg/builder/state/FfmpegState.ts';
import type { FfmpegInfo, FfmpegVersionResult } from '@/ffmpeg/ffmpegInfo.ts';
import type { StreamSelector } from '@/ffmpeg/StreamSelector.ts';
import type { FeatureFlagService } from '@/services/FeatureFlagService.ts';
import type { StreamDetails, SubtitleStreamDetails } from '@/stream/types.ts';
import { HttpStreamSource } from '@/stream/types.ts';
import type { SubtitlesInputSource } from '@/ffmpeg/builder/input/SubtitlesInputSource.ts';
import { SubtitleMethods } from '@/ffmpeg/builder/MediaStream.ts';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import { describe, expect, test, vi } from 'vitest';
import { FfmpegStreamFactory } from './FfmpegStreamFactory.ts';

vi.mock('@/util/serverUtil.ts', () => ({
  makeLocalUrl: (path: string) => `http://localhost:8000${path}`,
}));

dayjs.extend(duration);

const mockFfmpegVersion: FfmpegVersionResult = {
  versionString: '7.0',
  majorVersion: 7,
  minorVersion: 0,
  patchVersion: 0,
  isUnknown: false,
};

function makeTranscodeConfig(
  overrides: Partial<TranscodeConfigOrm> = {},
): TranscodeConfigOrm {
  return {
    uuid: 'test-uuid',
    name: 'Test',
    threadCount: 0,
    hardwareAccelerationMode: 'none',
    vaapiDriver: 'system',
    vaapiDevice: null,
    resolution: { widthPx: 1920, heightPx: 1080 },
    videoFormat: 'h264',
    videoProfile: null,
    videoPreset: null,
    videoBitDepth: 8,
    videoBitRate: 2000,
    videoBufferSize: 4000,
    audioChannels: 2,
    audioFormat: 'aac',
    audioBitRate: 192,
    audioBufferSize: 384,
    audioSampleRate: 48,
    audioVolumePercent: 100,
    audioLoudnormConfig: null,
    normalizeFrameRate: false,
    deinterlaceVideo: true,
    disableChannelOverlay: false,
    errorScreen: 'pic',
    errorScreenAudio: 'silent',
    isDefault: true,
    disableHardwareDecoder: false,
    disableHardwareEncoding: false,
    disableHardwareFilters: false,
    ...overrides,
  } as TranscodeConfigOrm;
}

function makeChannel(overrides: Partial<ChannelOrm> = {}): ChannelOrm {
  return {
    uuid: 'channel-uuid',
    name: 'Test Channel',
    number: 1,
    streamMode: 'hls',
    subtitlesEnabled: false,
    offline: { mode: 'pic' },
    duration: 0,
    groupTitle: null,
    stealth: false,
    fillerCollections: [],
    fillerRepeatCooldownMs: 0,
    transcodeConfigId: null,
    icon: null,
    startTime: 0,
    ...overrides,
  } as ChannelOrm;
}

function makeFfmpegSettings(): ReadableFfmpegSettings {
  return {
    configVersion: 5,
    ffmpegExecutablePath: '/usr/bin/ffmpeg',
    ffprobeExecutablePath: '/usr/bin/ffprobe',
    enableLogging: false,
    enableFileLogging: false,
    logLevel: 'warning',
    languagePreferences: {
      preferences: [{ iso6391: 'en', iso6392: 'eng', displayName: 'English' }],
    },
    scalingAlgorithm: 'bicubic',
    deinterlaceFilter: 'none',
    hlsDirectOutputFormat: 'mpegts',
    enableSubtitleExtraction: false,
  } as ReadableFfmpegSettings;
}

function makeStreamDetails(): StreamDetails {
  return {
    duration: dayjs.duration({ seconds: 30 }),
    videoDetails: [
      {
        codec: 'h264',
        profile: 'Main',
        width: 1920,
        height: 1080,
        framerate: 24,
        pixelFormat: 'yuv420p',
        bitDepth: 8,
        streamIndex: 0,
        sampleAspectRatio: '1:1',
        displayAspectRatio: '16:9',
        anamorphic: false,
        bitrate: 5000,
        isAttachedPic: false,
        colorRange: null,
        colorSpace: null,
        colorTransfer: null,
        colorPrimaries: null,
      },
    ],
    audioDetails: [
      {
        codec: 'aac',
        channels: 2,
        index: 1,
      },
    ],
  };
}

function makeLineupItem(): ContentBackedStreamLineupItem {
  return {
    type: 'program',
    streamDuration: 30000,
    programBeginMs: 0,
    duration: 30000,
    infiniteLoop: false,
    program: {
      uuid: 'program-uuid',
      mediaSourceId: 'source-id',
      externalIds: [],
    },
  } as ContentBackedStreamLineupItem;
}

/**
 * Creates a mock PipelineBuilderFactory that intercepts PipelineBuilder.build()
 * to capture the FrameState for assertion.
 */
function createCapturingPipelineBuilderFactory(): {
  factory: PipelineBuilderFactory;
  getCapturedFrameState: () => FrameState | undefined;
  getCapturedFfmpegState: () => FfmpegState | undefined;
  getCapturedHwAccel: () => string | undefined;
  getCapturedSubtitleInput: () => SubtitlesInputSource | null | undefined;
} {
  let capturedFrameState: FrameState | undefined;
  let capturedFfmpegState: FfmpegState | undefined;
  let capturedHwAccel: string | undefined;
  let capturedSubtitleInput: SubtitlesInputSource | null | undefined;

  const factory: PipelineBuilderFactory = () => {
    const builderProxy: Record<string, unknown> = {};
    for (const method of [
      'setVideoInputSource',
      'setAudioInputSource',
      'setWatermarkInputSource',
      'setConcatInputSource',
    ]) {
      builderProxy[method] = vi.fn().mockReturnValue(builderProxy);
    }

    builderProxy.setSubtitleInputSource = vi.fn(
      (input: SubtitlesInputSource | null) => {
        capturedSubtitleInput = input;
        return builderProxy;
      },
    );

    builderProxy.setHardwareAccelerationMode = vi.fn((mode: string) => {
      capturedHwAccel = mode;
      return builderProxy;
    });

    builderProxy.build = vi.fn().mockResolvedValue({
      build: (ffmpegState: FfmpegState, frameState: FrameState) => {
        capturedFfmpegState = ffmpegState;
        capturedFrameState = frameState;
        return {
          getCommandArgs: () => [],
          getCommandEnvironment: () => ({}),
          inputs: {},
          steps: [],
          setInputs: vi.fn(),
        };
      },
    } as unknown as PipelineBuilder);

    return builderProxy as ReturnType<PipelineBuilderFactory>;
  };

  return {
    factory,
    getCapturedFrameState: () => capturedFrameState,
    getCapturedFfmpegState: () => capturedFfmpegState,
    getCapturedHwAccel: () => capturedHwAccel,
    getCapturedSubtitleInput: () => capturedSubtitleInput,
  };
}

function makeMockFfmpegInfo(): FfmpegInfo {
  return {
    getVersion: vi.fn().mockResolvedValue(mockFfmpegVersion),
  } as unknown as FfmpegInfo;
}

function makeMockSettingsDB(
  ffmpegSettings: ReadableFfmpegSettings,
): ISettingsDB {
  return {
    systemSettings: vi.fn().mockReturnValue({
      logging: { logsDirectory: null },
    }),
    ffmpegSettings: vi.fn().mockReturnValue(ffmpegSettings),
  } as unknown as ISettingsDB;
}

function makeMockChannelDB(): IChannelDB {
  return {
    getChannelSubtitlePreferences: vi.fn().mockResolvedValue([]),
  } as unknown as IChannelDB;
}

function makeMockFeatureFlagService(
  flags: Record<string, boolean> = {},
): FeatureFlagService {
  return {
    get: vi.fn((flag: string) => flags[flag] ?? false),
    getAll: vi.fn().mockReturnValue(flags),
  } as unknown as FeatureFlagService;
}

function makeMockStreamSelector(
  subtitleStream: SubtitleStreamDetails | null = null,
): StreamSelector {
  return {
    selectAudioAndSubtitleStreams: vi.fn().mockImplementation(async () => ({
      audioStream: { index: 1, codec: 'aac', channels: 2 },
      subtitleStream,
    })),
  } as unknown as StreamSelector;
}

describe('FfmpegStreamFactory', () => {
  describe('videoPreset wiring into FrameState', () => {
    test('createStreamSession passes videoPreset=veryfast for software h264', async () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });
      const { factory, getCapturedFrameState } =
        createCapturingPipelineBuilderFactory();

      const ffmpegSettings = makeFfmpegSettings();
      const sut = new FfmpegStreamFactory(
        makeMockFfmpegInfo(),
        makeMockSettingsDB(ffmpegSettings),
        factory,
        makeMockChannelDB(),
        makeMockFeatureFlagService(),
        makeMockStreamSelector(),
        config,
        makeChannel(),
      );

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: makeStreamDetails(),
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: MpegTsOutputFormat,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const frameState = getCapturedFrameState();
      expect(frameState).toBeDefined();
      expect(frameState!.videoPreset).toBe(VideoPresets.VeryFast);
    });

    test('createStreamSession passes videoPreset=veryfast for software hevc', async () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'hevc',
      });
      const { factory, getCapturedFrameState } =
        createCapturingPipelineBuilderFactory();

      const ffmpegSettings = makeFfmpegSettings();
      const sut = new FfmpegStreamFactory(
        makeMockFfmpegInfo(),
        makeMockSettingsDB(ffmpegSettings),
        factory,
        makeMockChannelDB(),
        makeMockFeatureFlagService(),
        makeMockStreamSelector(),
        config,
        makeChannel(),
      );

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: makeStreamDetails(),
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: MpegTsOutputFormat,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const frameState = getCapturedFrameState();
      expect(frameState).toBeDefined();
      expect(frameState!.videoPreset).toBe(VideoPresets.VeryFast);
    });

    test('createStreamSession does not set videoPreset for hardware-accelerated encoding', async () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'cuda',
        videoFormat: 'h264',
      });
      const { factory, getCapturedFrameState } =
        createCapturingPipelineBuilderFactory();

      const ffmpegSettings = makeFfmpegSettings();
      const sut = new FfmpegStreamFactory(
        makeMockFfmpegInfo(),
        makeMockSettingsDB(ffmpegSettings),
        factory,
        makeMockChannelDB(),
        makeMockFeatureFlagService(),
        makeMockStreamSelector(),
        config,
        makeChannel(),
      );

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: makeStreamDetails(),
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: MpegTsOutputFormat,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const frameState = getCapturedFrameState();
      expect(frameState).toBeDefined();
      expect(frameState!.videoPreset).toBeNull();
    });

    test('createErrorSession wires videoPreset into FrameState', async () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
        errorScreen: 'testsrc',
      });
      const { factory, getCapturedFrameState } =
        createCapturingPipelineBuilderFactory();

      const ffmpegSettings = makeFfmpegSettings();
      const sut = new FfmpegStreamFactory(
        makeMockFfmpegInfo(),
        makeMockSettingsDB(ffmpegSettings),
        factory,
        makeMockChannelDB(),
        makeMockFeatureFlagService(),
        makeMockStreamSelector(),
        config,
        makeChannel(),
      );

      await sut.createErrorSession(
        'Test Error',
        null,
        dayjs.duration({ seconds: 10 }),
        MpegTsOutputFormat,
        true,
      );

      const frameState = getCapturedFrameState();
      expect(frameState).toBeDefined();
      // calculateForErrorStream doesn't compute a videoPreset, so it should be null
      expect(frameState!.videoPreset).toBeNull();
    });

    test('createOfflineSession wires videoPreset into FrameState', async () => {
      const config = makeTranscodeConfig({
        hardwareAccelerationMode: 'none',
        videoFormat: 'h264',
      });
      const { factory, getCapturedFrameState } =
        createCapturingPipelineBuilderFactory();

      const ffmpegSettings = makeFfmpegSettings();
      const sut = new FfmpegStreamFactory(
        makeMockFfmpegInfo(),
        makeMockSettingsDB(ffmpegSettings),
        factory,
        makeMockChannelDB(),
        makeMockFeatureFlagService(),
        makeMockStreamSelector(),
        config,
        makeChannel(),
      );

      await sut.createOfflineSession(
        dayjs.duration({ seconds: 10 }),
        MpegTsOutputFormat,
      );

      const frameState = getCapturedFrameState();
      expect(frameState).toBeDefined();
      // calculateForErrorStream (used by offline) doesn't set videoPreset
      expect(frameState!.videoPreset).toBeNull();
    });
  });

  describe('passthrough mode (HlsDirectV2 / remux)', () => {
    const hlsDirectV2Format = HlsDirectOutputFormat(defaultHlsOptions);

    function createPassthroughSut(
      configOverrides: Partial<TranscodeConfigOrm> = {},
      streamDetails?: StreamDetails,
    ) {
      const config = makeTranscodeConfig(configOverrides);
      const capturing = createCapturingPipelineBuilderFactory();

      const sut = new FfmpegStreamFactory(
        makeMockFfmpegInfo(),
        makeMockSettingsDB(makeFfmpegSettings()),
        capturing.factory,
        makeMockChannelDB(),
        makeMockFeatureFlagService(),
        makeMockStreamSelector(),
        config,
        makeChannel(),
      );

      return {
        sut,
        ...capturing,
        streamDetails: streamDetails ?? makeStreamDetails(),
      };
    }

    test('HlsDirectV2 does not crash (playbackParams is null)', async () => {
      const { sut, getCapturedFrameState, streamDetails } =
        createPassthroughSut();

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: streamDetails,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: hlsDirectV2Format,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      expect(getCapturedFrameState()).toBeDefined();
    });

    test('remux mode does not crash (playbackParams is null)', async () => {
      const { sut, getCapturedFrameState, streamDetails } =
        createPassthroughSut();

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: streamDetails,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: MpegTsOutputFormat,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
          encoding: { mode: 'remux' },
        },
        lineupItem: makeLineupItem(),
      });

      expect(getCapturedFrameState()).toBeDefined();
    });

    test('HlsDirectV2 sets passthrough defaults in FrameState', async () => {
      const { sut, getCapturedFrameState, streamDetails } =
        createPassthroughSut();

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: streamDetails,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: hlsDirectV2Format,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const frameState = getCapturedFrameState()!;
      expect(frameState.videoFormat).toBe(VideoFormats.Copy);
      // videoPreset falls back to DefaultFrameState (null) because lodash
      // merge skips the undefined value passed in passthrough mode.
      expect(frameState.videoPreset).toBeNull();
      expect(frameState.deinterlace).toBe(false);
      expect(frameState.videoBitrate).toBeNull();
      expect(frameState.videoBufferSize).toBeNull();
      expect(frameState.frameRate).toBeNull();
      expect(frameState.videoTrackTimescale).toBe(90000);
    });

    test('passthrough forces hardware acceleration to none', async () => {
      const { sut, getCapturedHwAccel, streamDetails } = createPassthroughSut({
        hardwareAccelerationMode: 'cuda',
      });

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: streamDetails,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: hlsDirectV2Format,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      expect(getCapturedHwAccel()).toBe('none');
    });

    test('passthrough sets copyAllStreams and zeroes threadCount in FfmpegState', async () => {
      const { sut, getCapturedFfmpegState, streamDetails } =
        createPassthroughSut({ threadCount: 4 });

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details: streamDetails,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: hlsDirectV2Format,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const ffmpegState = getCapturedFfmpegState()!;
      expect(ffmpegState.copyAllStreams).toBe(true);
      expect(ffmpegState.threadCount).toBe(0);
      expect(ffmpegState.vaapiDevice).toBeNull();
      expect(ffmpegState.vaapiDriver).toBeNull();
      // lodash merge skips undefined, so FfmpegState class defaults are kept.
      expect(ffmpegState.softwareDeinterlaceFilter).toBe('yadif=1');
      expect(ffmpegState.softwareScalingAlgorithm).toBe('fast_bilinear');
    });

    test('passthrough builds audio codec overrides for DTS/TrueHD', async () => {
      const details = makeStreamDetails();
      details.audioDetails = [
        { codec: AudioFormats.Aac, channels: 2, index: 1 },
        { codec: AudioFormats.Dca, channels: 6, index: 2 },
        { codec: AudioFormats.TrueHd, channels: 8, index: 3 },
      ];

      const { sut, getCapturedFfmpegState } = createPassthroughSut({}, details);

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: hlsDirectV2Format,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const ffmpegState = getCapturedFfmpegState()!;
      expect(ffmpegState.audioCodecOverrides).toEqual([
        { outputIndex: 1, codec: AudioFormats.Ac3 },
        { outputIndex: 2, codec: AudioFormats.Ac3 },
      ]);
    });

    test('passthrough uses source video dimensions for FrameState sizes', async () => {
      const details = makeStreamDetails();
      details.videoDetails = [
        {
          ...details.videoDetails![0],
          width: 3840,
          height: 2160,
        },
      ];

      const { sut, getCapturedFrameState } = createPassthroughSut(
        { resolution: { widthPx: 1920, heightPx: 1080 } },
        details,
      );

      await sut.createStreamSession({
        stream: {
          source: new HttpStreamSource('http://example.com/video.ts'),
          details,
        },
        options: {
          startTime: dayjs.duration(0),
          duration: dayjs.duration({ seconds: 30 }),
          outputFormat: hlsDirectV2Format,
          ptsOffset: 0,
          realtime: true,
          streamMode: 'hls',
        },
        lineupItem: makeLineupItem(),
      });

      const frameState = getCapturedFrameState()!;
      // In passthrough, scaled/padded sizes come from the source, not the
      // transcode config resolution (1920x1080).
      expect(frameState.scaledSize.width).toBe(3840);
      expect(frameState.scaledSize.height).toBe(2160);
      expect(frameState.paddedSize.width).toBe(3840);
      expect(frameState.paddedSize.height).toBe(2160);
    });
  });

  describe('subtitle handling', () => {
    const textSubtitleStream: SubtitleStreamDetails = {
      type: 'embedded',
      codec: 'subrip',
      index: 2,
      default: true,
      forced: false,
      sdh: false,
      language: 'English',
      languageCodeISO6392: 'eng',
      title: 'English SRT',
    };

    const imageSubtitleStream: SubtitleStreamDetails = {
      type: 'embedded',
      codec: 'hdmv_pgs_subtitle',
      index: 3,
      default: false,
      forced: false,
      sdh: false,
      language: 'English',
      languageCodeISO6392: 'eng',
      title: 'English PGS',
    };

    const externalSubtitleStream: SubtitleStreamDetails = {
      type: 'external',
      codec: 'subrip',
      default: false,
      forced: false,
      sdh: false,
      language: 'Spanish',
      languageCodeISO6392: 'spa',
      path: 'http://example.com/subs.srt',
      title: 'Spanish SRT',
    };

    describe('non-passthrough modes (HLS, mpegts, etc.)', () => {
      test('uses sidecar (Convert) when webvttSidecarEnabled and text-based subtitle', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService({ webvttSidecarEnabled: true }),
          makeMockStreamSelector(textSubtitleStream),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details: makeStreamDetails(),
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: { type: 'mpegts' as const },
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).not.toBeNull();
        expect(subtitleInput!.method).toBe(SubtitleMethods.Convert);
        expect(result!.renditions.subtitle).toEqual({
          language: 'eng',
          languageName: 'English',
          default: true,
          forced: false,
          title: 'English SRT',
        });
      });

      test('uses burn-in when webvttSidecarEnabled is false', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService({ webvttSidecarEnabled: false }),
          makeMockStreamSelector(textSubtitleStream),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details: makeStreamDetails(),
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: { type: 'mpegts' as const },
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).not.toBeNull();
        expect(subtitleInput!.method).toBe(SubtitleMethods.Burn);
        expect(result!.renditions.subtitle).toBeUndefined();
      });

      test('falls back to burn-in for image-based subtitles even when sidecar enabled', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService({ webvttSidecarEnabled: true }),
          makeMockStreamSelector(imageSubtitleStream),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details: makeStreamDetails(),
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: { type: 'mpegts' as const },
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).not.toBeNull();
        expect(subtitleInput!.method).toBe(SubtitleMethods.Burn);
        expect(result!.renditions.subtitle).toBeUndefined();
      });

      test('skips subtitles when channel.subtitlesEnabled is false', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService({ webvttSidecarEnabled: true }),
          makeMockStreamSelector(textSubtitleStream),
          config,
          makeChannel({ subtitlesEnabled: false }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details: makeStreamDetails(),
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: { type: 'mpegts' as const },
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).toBeNull();
        expect(result!.renditions.subtitle).toBeUndefined();
      });

      test('skips subtitles when stream selector returns no subtitle', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService({ webvttSidecarEnabled: true }),
          makeMockStreamSelector(null),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details: makeStreamDetails(),
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: { type: 'mpegts' as const },
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).toBeNull();
        expect(result!.renditions.subtitle).toBeUndefined();
      });

      test('handles external subtitle streams with sidecar', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService({ webvttSidecarEnabled: true }),
          makeMockStreamSelector(externalSubtitleStream),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details: makeStreamDetails(),
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: { type: 'mpegts' as const },
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).not.toBeNull();
        expect(subtitleInput!.method).toBe(SubtitleMethods.Convert);
        expect(result!.renditions.subtitle).toEqual({
          language: 'spa',
          languageName: 'Spanish',
          default: false,
          forced: false,
          title: 'Spanish SRT',
        });
      });
    });

    describe('passthrough mode (remux / HlsDirectV2)', () => {
      const hlsDirectV2Format = HlsDirectOutputFormat(defaultHlsOptions);

      test('uses sidecar (Convert) for text-based subtitles', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();
        const details = makeStreamDetails();
        details.subtitleDetails = [textSubtitleStream];

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService(),
          makeMockStreamSelector(),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details,
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: hlsDirectV2Format,
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).not.toBeNull();
        expect(subtitleInput!.method).toBe(SubtitleMethods.Convert);
        expect(result!.renditions.subtitle).toEqual({
          language: 'eng',
          languageName: 'English',
          default: true,
          forced: false,
          title: 'English SRT',
        });
      });

      test('skips image-based subtitles (cannot sidecar or burn)', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();
        const details = makeStreamDetails();
        details.subtitleDetails = [imageSubtitleStream];

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService(),
          makeMockStreamSelector(),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details,
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: hlsDirectV2Format,
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).toBeNull();
        expect(result!.renditions.subtitle).toBeUndefined();
      });

      test('skips subtitles when channel.subtitlesEnabled is false', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();
        const details = makeStreamDetails();
        details.subtitleDetails = [textSubtitleStream];

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService(),
          makeMockStreamSelector(),
          config,
          makeChannel({ subtitlesEnabled: false }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details,
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: hlsDirectV2Format,
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).toBeNull();
        expect(result!.renditions.subtitle).toBeUndefined();
      });

      test('skips subtitles when no subtitle details in stream', async () => {
        const config = makeTranscodeConfig();
        const capturing = createCapturingPipelineBuilderFactory();
        const details = makeStreamDetails();
        // No subtitleDetails set

        const sut = new FfmpegStreamFactory(
          makeMockFfmpegInfo(),
          makeMockSettingsDB(makeFfmpegSettings()),
          capturing.factory,
          makeMockChannelDB(),
          makeMockFeatureFlagService(),
          makeMockStreamSelector(),
          config,
          makeChannel({ subtitlesEnabled: true }),
        );

        const result = await sut.createStreamSession({
          stream: {
            source: new HttpStreamSource('http://example.com/video.ts'),
            details,
          },
          options: {
            startTime: dayjs.duration(0),
            duration: dayjs.duration({ seconds: 30 }),
            outputFormat: hlsDirectV2Format,
            ptsOffset: 0,
            realtime: true,
            streamMode: 'hls',
          },
          lineupItem: makeLineupItem(),
        });

        const subtitleInput = capturing.getCapturedSubtitleInput();
        expect(subtitleInput).toBeNull();
        expect(result!.renditions.subtitle).toBeUndefined();
      });
    });
  });
});
