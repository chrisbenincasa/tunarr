import type { ContentBackedStreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import type { IChannelDB } from '@/db/interfaces/IChannelDB.ts';
import type {
  ISettingsDB,
  ReadableFfmpegSettings,
} from '@/db/interfaces/ISettingsDB.ts';
import type { ChannelOrm } from '@/db/schema/Channel.ts';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.ts';
import {
  MpegTsOutputFormat,
  VideoPresets,
} from '@/ffmpeg/builder/constants.ts';
import type { PipelineBuilder } from '@/ffmpeg/builder/pipeline/PipelineBuilder.ts';
import type { PipelineBuilderFactory } from '@/ffmpeg/builder/pipeline/PipelineBuilderFactory.ts';
import { FrameState } from '@/ffmpeg/builder/state/FrameState.ts';
import type { FfmpegInfo, FfmpegVersionResult } from '@/ffmpeg/ffmpegInfo.ts';
import type { StreamDetails } from '@/stream/types.ts';
import { HttpStreamSource } from '@/stream/types.ts';
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
} {
  let capturedFrameState: FrameState | undefined;

  const factory: PipelineBuilderFactory = () => {
    const builderProxy: Record<string, unknown> = {};
    for (const method of [
      'setHardwareAccelerationMode',
      'setVideoInputSource',
      'setAudioInputSource',
      'setWatermarkInputSource',
      'setSubtitleInputSource',
      'setConcatInputSource',
    ]) {
      builderProxy[method] = vi.fn().mockReturnValue(builderProxy);
    }

    builderProxy.build = vi.fn().mockResolvedValue({
      build: (_ffmpegState: unknown, frameState: FrameState) => {
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

  return { factory, getCapturedFrameState: () => capturedFrameState };
}

function makeMockFfmpegInfo(): FfmpegInfo {
  return {
    getVersion: vi.fn().mockResolvedValue(mockFfmpegVersion),
  } as unknown as FfmpegInfo;
}

function makeMockSettingsDB(): ISettingsDB {
  return {
    systemSettings: vi.fn().mockReturnValue({
      logging: { logsDirectory: null },
    }),
  } as unknown as ISettingsDB;
}

function makeMockChannelDB(): IChannelDB {
  return {} as unknown as IChannelDB;
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

      const sut = new FfmpegStreamFactory(
        makeFfmpegSettings(),
        config,
        makeChannel(),
        makeMockFfmpegInfo(),
        makeMockSettingsDB(),
        factory,
        makeMockChannelDB(),
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

      const sut = new FfmpegStreamFactory(
        makeFfmpegSettings(),
        config,
        makeChannel(),
        makeMockFfmpegInfo(),
        makeMockSettingsDB(),
        factory,
        makeMockChannelDB(),
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

      const sut = new FfmpegStreamFactory(
        makeFfmpegSettings(),
        config,
        makeChannel(),
        makeMockFfmpegInfo(),
        makeMockSettingsDB(),
        factory,
        makeMockChannelDB(),
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

      const sut = new FfmpegStreamFactory(
        makeFfmpegSettings(),
        config,
        makeChannel(),
        makeMockFfmpegInfo(),
        makeMockSettingsDB(),
        factory,
        makeMockChannelDB(),
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

      const sut = new FfmpegStreamFactory(
        makeFfmpegSettings(),
        config,
        makeChannel(),
        makeMockFfmpegInfo(),
        makeMockSettingsDB(),
        factory,
        makeMockChannelDB(),
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
});
