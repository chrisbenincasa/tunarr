import type { FfmpegSettings } from '@tunarr/types';
import { FfmpegSettingsSchema } from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import {
  UnsupportedTranscodeConfigError,
  findUnsupportedSettings,
  toChannelConfig,
} from './EtvNextChannelConfigMapper.ts';
import type { VaapiDriverResolver } from './EtvNextVaapi.ts';
import { ChannelConfigSchema } from './generated/channelConfig.ts';

const transcodeConfig = (
  overrides: Partial<TranscodeConfigOrm> = {},
): TranscodeConfigOrm => ({
  uuid: 'tc-1',
  name: 'Default',
  threadCount: 0,
  hardwareAccelerationMode: 'none',
  vaapiDriver: 'system',
  vaapiDevice: null,
  resolution: { widthPx: 1920, heightPx: 1080 },
  videoFormat: 'h264',
  videoProfile: null,
  videoPreset: null,
  videoBitDepth: 8,
  videoBitRate: 10000,
  videoBufferSize: 20000,
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
  isDefault: false,
  disableHardwareDecoder: false,
  disableHardwareEncoding: false,
  disableHardwareFilters: false,
  ...overrides,
});

const ffmpegSettings = (
  overrides: Partial<FfmpegSettings> = {},
): FfmpegSettings =>
  FfmpegSettingsSchema.parse({
    ffmpegExecutablePath: '/usr/bin/ffmpeg',
    ffprobeExecutablePath: '/usr/bin/ffprobe',
    deinterlaceFilter: 'yadif=1',
    scalingAlgorithm: 'fast_bilinear',
    transcodeDirectory: '/var/lib/tunarr/transcode',
    ...overrides,
  });

/**
 * Stands in for reading the render node's PCI vendor id, so these stay
 * deterministic on a machine with no GPU.
 */
const noGpu = () => undefined;
const intelGpu = () => 'ihd' as const;

const map = (
  tc: Partial<TranscodeConfigOrm> = {},
  fs: Partial<FfmpegSettings> = {},
  resolveVaapiDriver: VaapiDriverResolver = noGpu,
) =>
  toChannelConfig({
    transcodeConfig: transcodeConfig(tc),
    ffmpegSettings: ffmpegSettings(fs),
    playoutFolder: '/var/lib/tunarr/transcode/etv_abc/playout',
    resolveVaapiDriver,
  });

describe('toChannelConfig', () => {
  test('produces a document the generated schema accepts', () => {
    const { config } = map();

    expect(ChannelConfigSchema.safeParse(config).error?.issues).toBeUndefined();
    expect(config.normalization.video).toMatchObject({
      format: 'h264',
      width: 1920,
      height: 1080,
      bitrate_kbps: 10000,
      buffer_kbps: 20000,
      bit_depth: 8,
      deinterlace: true,
    });
    expect(config.normalization.audio).toMatchObject({
      format: 'aac',
      bitrate_kbps: 192,
      buffer_kbps: 384,
      channels: 2,
      sample_rate_hz: 48000,
    });
    expect(config.playout.folder).toBe(
      '/var/lib/tunarr/transcode/etv_abc/playout',
    );
  });

  test('omits accel entirely when hardware acceleration is off', () => {
    const { config } = map({ hardwareAccelerationMode: 'none' });

    expect(config.normalization.video.accel).toBeUndefined();
    expect('accel' in config.normalization.video).toBe(false);
  });

  test('carries vaapi device and driver only when accelerating', () => {
    const { config } = map({
      hardwareAccelerationMode: 'vaapi',
      vaapiDriver: 'ihd',
      vaapiDevice: '/dev/dri/renderD128',
    });

    expect(config.normalization.video).toMatchObject({
      accel: 'vaapi',
      vaapi_driver: 'ihd',
      vaapi_device: '/dev/dri/renderD128',
    });
  });

  test('names a driver for `system`, which the backend needs to accelerate at all', () => {
    const { config, ignored } = map(
      {
        hardwareAccelerationMode: 'vaapi',
        vaapiDriver: 'system',
        vaapiDevice: '/dev/dri/renderD128',
      },
      {},
      intelGpu,
    );

    expect(config.normalization.video).toMatchObject({
      accel: 'vaapi',
      vaapi_driver: 'ihd',
      vaapi_device: '/dev/dri/renderD128',
    });
    expect(ignored.map((i) => i.field)).not.toContain(
      'hardwareAccelerationMode',
    );
  });

  test('fills in the default render node when the config names none', () => {
    const { config } = map(
      {
        hardwareAccelerationMode: 'vaapi',
        vaapiDriver: 'system',
        vaapiDevice: null,
      },
      {},
      intelGpu,
    );

    expect(config.normalization.video.vaapi_device).toBe('/dev/dri/renderD128');
  });

  test('warns that accel is lost when no driver can be determined', () => {
    const { config, ignored } = map(
      {
        hardwareAccelerationMode: 'vaapi',
        vaapiDriver: 'system',
        vaapiDevice: '/dev/dri/renderD128',
      },
      {},
      noGpu,
    );

    // Emitted without a driver the backend ignores `accel` entirely, so the
    // user is told rather than left with a channel that quietly uses the CPU.
    expect(config.normalization.video.vaapi_driver).toBeUndefined();
    expect(ignored).toContainEqual({
      field: 'hardwareAccelerationMode',
      reason:
        'the backend needs both a VAAPI device and driver, and neither could be determined here, so this channel will transcode in software',
    });
  });

  test('reports nouveau as dropped rather than substituting a different driver', () => {
    const { config, ignored } = map({
      hardwareAccelerationMode: 'vaapi',
      vaapiDriver: 'nouveau',
    });

    expect(config.normalization.video.vaapi_driver).toBeUndefined();
    expect(ignored).toContainEqual({
      field: 'vaapiDriver',
      reason: 'nouveau has no counterpart in the backend',
    });
    expect(ignored.map((i) => i.field)).toContain('hardwareAccelerationMode');
  });

  test.each([
    ['yadif=0', { yadif: { mode: '0' } }],
    ['yadif=1', { yadif: { mode: '1' } }],
    ['bwdif=0', { bwdif: { mode: '0' } }],
    ['bwdif=1', { bwdif: { mode: '1' } }],
    ['w3fdif', { w3fdif: {} }],
  ])(
    'splits the global deinterlace filter %s into per-filter options',
    (filter, expected) => {
      const { config } = map(
        { deinterlaceVideo: true },
        {
          deinterlaceFilter: filter as FfmpegSettings['deinterlaceFilter'],
        },
      );

      expect(config.normalization.video.filters).toEqual(expected);
    },
  );

  test('emits no filter options when deinterlacing is off', () => {
    const { config } = map(
      { deinterlaceVideo: false },
      { deinterlaceFilter: 'yadif=1' },
    );

    expect(config.normalization.video.deinterlace).toBe(false);
    expect(config.normalization.video.filters).toBeUndefined();
  });

  test('maps the loudnorm triple onto the loudness block', () => {
    const { config } = map({
      audioLoudnormConfig: { i: -16, lra: 11, tp: -1.5 },
    });

    expect(config.normalization.audio).toMatchObject({
      normalize_loudness: true,
      loudness: { integrated_target: -16, range_target: 11, true_peak: -1.5 },
    });
  });

  test('leaves loudness out when the channel does not normalize', () => {
    const { config } = map({ audioLoudnormConfig: null });

    expect(config.normalization.audio.normalize_loudness).toBeUndefined();
    expect(config.normalization.audio.loudness).toBeUndefined();
  });

  test('sets the reports folder only when file logging is on', () => {
    expect(
      map({}, { enableFileLogging: false }).config.ffmpeg.reports_folder,
    ).toBeUndefined();
    expect(
      map({}, { enableFileLogging: true }).config.ffmpeg.reports_folder,
    ).toBe('/var/lib/tunarr/transcode');
  });

  test('asks the backend to burn the failure reason into frame unless the screen is blank', () => {
    expect(map({ errorScreen: 'pic' }).config.fallback?.show_error).toBe(true);
    expect(map({ errorScreen: 'blank' }).config.fallback?.show_error).toBe(
      false,
    );
  });

  test('names every setting that does not survive the crossing', () => {
    const { ignored } = map(
      {
        threadCount: 4,
        videoPreset: 'veryfast',
        videoProfile: 'high',
        audioVolumePercent: 80,
        normalizeFrameRate: true,
      },
      { scalingAlgorithm: 'bicubic' },
    );

    expect(ignored.map((i) => i.field).sort()).toEqual([
      'audioVolumePercent',
      'normalizeFrameRate',
      'scalingAlgorithm',
      'threadCount',
      'videoPreset',
      'videoProfile',
    ]);
  });

  test('reports nothing ignored for a config that maps cleanly', () => {
    expect(map().ignored).toEqual([]);
  });

  // The backend rejects a spawn on a missing bit_depth even though its schema
  // marks the field optional, so the mapper must always emit one.
  // Tunarr stores kHz and the backend wants Hz. Getting this wrong produces a
  // config that parses cleanly and then kills ffmpeg's aac encoder at runtime.
  test('converts the sample rate from kilohertz to hertz', () => {
    expect(
      map({ audioSampleRate: 48 }).config.normalization.audio.sample_rate_hz,
    ).toBe(48000);
    expect(
      map({ audioSampleRate: 44 }).config.normalization.audio.sample_rate_hz,
    ).toBe(44000);
  });

  test('always emits a bit depth, defaulting to 8 when Tunarr has none', () => {
    expect(
      map({ videoBitDepth: null }).config.normalization.video.bit_depth,
    ).toBe(8);
    expect(
      map({ videoBitDepth: 10 }).config.normalization.video.bit_depth,
    ).toBe(10);
  });
});

describe('unsupported transcode configs', () => {
  test.each(['mpeg2video'] as const)(
    'refuses video format %s by name',
    (videoFormat) => {
      const settings = findUnsupportedSettings(
        transcodeConfig({ videoFormat }),
      );

      expect(settings).toHaveLength(1);
      expect(settings[0].field).toBe('videoFormat');
      expect(() => map({ videoFormat })).toThrow(
        UnsupportedTranscodeConfigError,
      );
    },
  );

  // The backend encodes aac and ac3 only. The integration plan listed copy and
  // mp3; libopus and eac3 are equally unsupported and are caught here because
  // the rule is derived from the generated enum rather than written out.
  test.each(['copy', 'mp3', 'libopus', 'eac3'] as const)(
    'refuses audio format %s by name',
    (audioFormat) => {
      const settings = findUnsupportedSettings(
        transcodeConfig({ audioFormat }),
      );

      expect(settings).toHaveLength(1);
      expect(settings[0].field).toBe('audioFormat');
      expect(settings[0].reason).toContain('aac, ac3');
    },
  );

  test.each(['aac', 'ac3'] as const)(
    'accepts audio format %s',
    (audioFormat) => {
      expect(findUnsupportedSettings(transcodeConfig({ audioFormat }))).toEqual(
        [],
      );
    },
  );

  test.each(['cuda', 'vaapi', 'qsv', 'videotoolbox'] as const)(
    'accepts hardware acceleration mode %s',
    (hardwareAccelerationMode) => {
      expect(
        findUnsupportedSettings(transcodeConfig({ hardwareAccelerationMode })),
      ).toEqual([]);
    },
  );

  test('reports every unsupported field at once rather than the first', () => {
    const settings = findUnsupportedSettings(
      transcodeConfig({ videoFormat: 'mpeg2video', audioFormat: 'mp3' }),
    );

    expect(settings.map((s) => s.field)).toEqual([
      'videoFormat',
      'audioFormat',
    ]);
  });

  test('the error message names the fields to change', () => {
    expect(() =>
      map({ videoFormat: 'mpeg2video', audioFormat: 'mp3' }),
    ).toThrow(/videoFormat \(mpeg2video\).*audioFormat \(mp3\)/s);
  });
});
