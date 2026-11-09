import { describe, expect, test } from 'vitest';
import type { HardwareSelection } from './EtvNextChannelConfigMapper.ts';
import { ChannelConfigVersion } from './EtvNextChannelConfigMapper.ts';
import { findHardwareWarnings, probeOverlay } from './EtvNextHardwareCheck.ts';
import type { AccelRuntime, RuntimeCapability } from './generated/describe.ts';

const accelEntry = (overrides: Partial<AccelRuntime> = {}): AccelRuntime => ({
  accel: 'vaapi',
  configured: false,
  status: 'available',
  error: null,
  device: '/dev/dri/renderD128',
  driver: null,
  decode: [],
  encode: [
    { format: 'h264', bit_depths: [8] },
    { format: 'hevc', bit_depths: [8, 10] },
  ],
  ...overrides,
});

const runtime = (accels: AccelRuntime[]): RuntimeCapability => ({
  ffmpeg: { path: 'ffmpeg', version: '8.1.2-etv.8', hwaccels: ['vaapi'] },
  accels,
});

const selection = (
  overrides: Partial<HardwareSelection> = {},
): HardwareSelection => ({
  accel: 'vaapi',
  videoFormat: 'hevc',
  bitDepth: 10,
  bitrateKbps: 10000,
  bufferKbps: 20000,
  ...overrides,
});

describe('probeOverlay', () => {
  test('carries the channel config version the worker requires', () => {
    expect(probeOverlay(selection())).toEqual({
      version: ChannelConfigVersion,
      normalization: {
        video: {
          accel: 'vaapi',
          format: 'hevc',
          bit_depth: 10,
          bitrate_kbps: 10000,
          buffer_kbps: 20000,
        },
      },
    });
  });

  // The worker's config finalize fails an mpeg2video config without a
  // bitrate, so the probe would exit before reporting anything.
  test('gives an mpeg2video overlay the bitrate the worker requires', () => {
    const overlay = probeOverlay(
      selection({ videoFormat: 'mpeg2video', bitDepth: 8, bitrateKbps: 6000 }),
    );

    expect(overlay.normalization.video).toMatchObject({
      format: 'mpeg2video',
      bitrate_kbps: 6000,
    });
  });

  test('adds the VAAPI device and driver only when set', () => {
    const overlay = probeOverlay(
      selection({ vaapiDevice: '/dev/dri/renderD129', vaapiDriver: 'ihd' }),
    );

    expect(overlay.normalization.video).toMatchObject({
      vaapi_device: '/dev/dri/renderD129',
      vaapi_driver: 'ihd',
    });
  });
});

describe('findHardwareWarnings', () => {
  test('is empty when the configured accel encodes the format and bit depth', () => {
    expect(findHardwareWarnings(runtime([accelEntry()]), selection())).toEqual(
      [],
    );
  });

  test('reads the entry the worker marked as configured', () => {
    const probed = runtime([
      accelEntry({ driver: null }),
      accelEntry({
        driver: 'i965',
        configured: true,
        status: 'probe_failed',
        error: 'init failed',
      }),
    ]);

    expect(
      findHardwareWarnings(probed, selection({ vaapiDriver: 'i965' })),
    ).toEqual([
      {
        field: 'hardwareAccelerationMode',
        reason: 'could not open vaapi on /dev/dri/renderD128: init failed',
      },
    ]);
  });

  test('flags an accel the platform does not offer', () => {
    expect(
      findHardwareWarnings(
        runtime([accelEntry()]),
        selection({ accel: 'videotoolbox' }),
      ),
    ).toEqual([
      {
        field: 'hardwareAccelerationMode',
        reason: 'videotoolbox is not available on this platform',
      },
    ]);
  });

  test('flags an ffmpeg build without the accel', () => {
    const probed = runtime([
      accelEntry({ status: 'ffmpeg_missing', encode: [], device: null }),
    ]);

    expect(findHardwareWarnings(probed, selection())).toEqual([
      {
        field: 'hardwareAccelerationMode',
        reason:
          'the configured ffmpeg has no vaapi support, so channels encode in software',
      },
    ]);
  });

  test('flags a probe that did not finish', () => {
    const probed = runtime([accelEntry({ status: 'timeout', encode: [] })]);

    expect(findHardwareWarnings(probed, selection())).toEqual([
      expect.objectContaining({
        reason: 'the vaapi probe did not finish',
      }),
    ]);
  });

  test('flags a format the hardware cannot encode', () => {
    expect(
      findHardwareWarnings(
        runtime([accelEntry()]),
        selection({ videoFormat: 'mpeg2video', bitDepth: 8 }),
      ),
    ).toEqual([
      {
        field: 'videoFormat',
        reason:
          'vaapi cannot encode mpeg2video on this machine, so it encodes in software',
      },
    ]);
  });

  test('flags a bit depth the hardware cannot encode', () => {
    expect(
      findHardwareWarnings(
        runtime([accelEntry()]),
        selection({ videoFormat: 'h264', bitDepth: 10 }),
      ),
    ).toEqual([
      {
        field: 'videoBitDepth',
        reason:
          'vaapi cannot encode 10-bit h264 on this machine, so it encodes in software',
      },
    ]);
  });
});
