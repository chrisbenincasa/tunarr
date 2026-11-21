import type { HardwareSelection } from './EtvNextChannelConfigMapper.ts';
import { ChannelConfigVersion } from './EtvNextChannelConfigMapper.ts';
import type { AccelRuntime, RuntimeCapability } from './generated/describe.ts';

/** One reason this machine cannot encode a config the way it asks. */
export type HardwareWarning = {
  field: string;
  reason: string;
};

/**
 * The partial channel config `describe --probe` reads. The worker marks the
 * accel, device and driver it selects as `configured`. The worker refuses an
 * overlay without a version, and an mpeg2video overlay without a bitrate.
 */
export function probeOverlay(selection: HardwareSelection) {
  return {
    version: ChannelConfigVersion,
    normalization: {
      video: {
        accel: selection.accel,
        format: selection.videoFormat,
        bit_depth: selection.bitDepth,
        bitrate_kbps: selection.bitrateKbps,
        buffer_kbps: selection.bufferKbps,
        ...(selection.vaapiDevice
          ? { vaapi_device: selection.vaapiDevice }
          : {}),
        ...(selection.vaapiDriver
          ? { vaapi_driver: selection.vaapiDriver }
          : {}),
      },
    },
  };
}

/**
 * Compares a config's hardware selection with what the probe found on this
 * machine. An empty list means the worker can encode the config in hardware.
 */
export function findHardwareWarnings(
  runtime: RuntimeCapability,
  selection: HardwareSelection,
): HardwareWarning[] {
  const { accel, videoFormat, bitDepth } = selection;
  const candidates = runtime.accels.filter((a) => a.accel === accel);
  const entry = candidates.find((a) => a.configured) ?? candidates[0];

  if (!entry) {
    return [
      {
        field: 'hardwareAccelerationMode',
        reason: `${accel} is not available on this platform`,
      },
    ];
  }

  if (entry.status !== 'available') {
    return [{ field: 'hardwareAccelerationMode', reason: statusReason(entry) }];
  }

  const encode = entry.encode.find((e) => e.format === videoFormat);
  if (!encode) {
    return [
      {
        field: 'videoFormat',
        reason: `${accel} cannot encode ${videoFormat} on this machine, so it encodes in software`,
      },
    ];
  }

  if (!encode.bit_depths.includes(bitDepth)) {
    return [
      {
        field: 'videoBitDepth',
        reason: `${accel} cannot encode ${bitDepth}-bit ${videoFormat} on this machine, so it encodes in software`,
      },
    ];
  }

  return [];
}

function statusReason(entry: AccelRuntime): string {
  const { accel, device, error } = entry;
  const detail = error ? `: ${error}` : '';

  switch (entry.status) {
    case 'ffmpeg_missing':
      return `the configured ffmpeg has no ${accel} support, so channels encode in software`;
    case 'probe_failed':
      return `could not open ${accel}${device ? ` on ${device}` : ''}${detail}`;
    case 'timeout':
      return `the ${accel} probe did not finish${detail}`;
    case 'skipped':
      return `the ${accel} probe was skipped because an earlier ${accel} probe did not finish`;
    case 'available':
      return `${accel} is available`;
  }
}
