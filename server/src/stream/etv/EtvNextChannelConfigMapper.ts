import type { FfmpegSettings } from '@tunarr/types';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import type {
  AudioFormat,
  ChannelConfig,
  HardwareAccel,
  VaapiDriver,
  VideoFilterOptionsConfig,
  VideoFormat,
} from './generated/channelConfig.ts';
import {
  AudioFormatSchema,
  ChannelConfigSchema,
  HardwareAccelSchema,
  VaapiDriverSchema,
  VideoFormatSchema,
} from './generated/channelConfig.ts';

/**
 * The ffmpeg settings this mapper reads, as a readonly view.
 *
 * Narrowed rather than taking the whole settings object so the dependency is
 * visible, and readonly because `settingsDB.ffmpegSettings()` hands back a
 * frozen view.
 */
export type MappedFfmpegSettings = Readonly<
  Pick<
    FfmpegSettings,
    | 'ffmpegExecutablePath'
    | 'ffprobeExecutablePath'
    | 'scalingAlgorithm'
    | 'deinterlaceFilter'
    | 'enableFileLogging'
    | 'transcodeDirectory'
  >
>;

/**
 * A transcode config setting that `etv_next` cannot express. Channels are
 * refused at assign time rather than silently substituted, so the message names
 * the field the user has to change.
 */
export type UnsupportedSetting = {
  field: string;
  value: string;
  reason: string;
};

/** A setting that maps to nothing upstream and is dropped rather than refused. */
export type IgnoredSetting = {
  field: string;
  reason: string;
};

export type ChannelConfigMapping = {
  config: ChannelConfig;
  ignored: IgnoredSetting[];
};

export class UnsupportedTranscodeConfigError extends Error {
  constructor(readonly settings: UnsupportedSetting[]) {
    super(
      `This transcode config cannot be used with the ErsatzTV next backend: ${settings
        .map((s) => `${s.field} (${s.value}) ${s.reason}`)
        .join('; ')}`,
    );
    this.name = 'UnsupportedTranscodeConfigError';
  }
}

// Derived from the generated schema rather than written out, so regenerating
// after upstream adds a format widens the validation automatically.
const supportedVideoFormats = new Set<string>(VideoFormatSchema.options);
const supportedAudioFormats = new Set<string>(AudioFormatSchema.options);
const supportedAccelModes = new Set<string>(HardwareAccelSchema.options);
const supportedVaapiDrivers = new Set<string>(VaapiDriverSchema.options);

const isSupportedVideoFormat = (value: string): value is VideoFormat =>
  supportedVideoFormats.has(value);

const isSupportedAudioFormat = (value: string): value is AudioFormat =>
  supportedAudioFormats.has(value);

const isSupportedAccel = (value: string): value is HardwareAccel =>
  supportedAccelModes.has(value);

const isSupportedVaapiDriver = (value: string): value is VaapiDriver =>
  supportedVaapiDrivers.has(value);

/**
 * Tunarr's deinterlace filter is one string naming both the filter and its
 * mode; `next` splits it into a per-filter options object.
 */
const deinterlaceFilters: Record<string, VideoFilterOptionsConfig> = {
  'bwdif=0': { bwdif: { mode: '0' } },
  'bwdif=1': { bwdif: { mode: '1' } },
  w3fdif: { w3fdif: {} },
  'yadif=0': { yadif: { mode: '0' } },
  'yadif=1': { yadif: { mode: '1' } },
};

/** The codec choices, once checked, in the types the generated schema wants. */
type SupportedCodecs = {
  videoFormat: VideoFormat;
  audioFormat: AudioFormat;
  accel: HardwareAccel | undefined;
};

type SupportCheck =
  | { supported: true; codecs: SupportedCodecs }
  | { supported: false; unsupported: UnsupportedSetting[] };

/** Validates and narrows in one pass, so the mapper never has to assert a cast. */
function checkSupport(transcodeConfig: TranscodeConfigOrm): SupportCheck {
  const unsupported: UnsupportedSetting[] = [];
  const { videoFormat, audioFormat, hardwareAccelerationMode } =
    transcodeConfig;

  if (!isSupportedVideoFormat(videoFormat)) {
    unsupported.push({
      field: 'videoFormat',
      value: videoFormat,
      reason: `is not an output format the backend can encode (it supports ${VideoFormatSchema.options.join(', ')})`,
    });
  }

  if (!isSupportedAudioFormat(audioFormat)) {
    unsupported.push({
      field: 'audioFormat',
      value: audioFormat,
      reason: `is not an output format the backend can encode (it supports ${AudioFormatSchema.options.join(', ')})`,
    });
  }

  // `none` is expressed by omitting `accel`, not by a value.
  const usesAccel = hardwareAccelerationMode !== 'none';
  if (usesAccel && !supportedAccelModes.has(hardwareAccelerationMode)) {
    unsupported.push({
      field: 'hardwareAccelerationMode',
      value: hardwareAccelerationMode,
      reason: `has no counterpart in the backend (it supports ${HardwareAccelSchema.options.join(', ')})`,
    });
  }

  if (
    unsupported.length > 0 ||
    !isSupportedVideoFormat(videoFormat) ||
    !isSupportedAudioFormat(audioFormat)
  ) {
    return { supported: false, unsupported };
  }

  return {
    supported: true,
    codecs: {
      videoFormat,
      audioFormat,
      accel:
        usesAccel && isSupportedAccel(hardwareAccelerationMode)
          ? hardwareAccelerationMode
          : undefined,
    },
  };
}

/** Reports why a transcode config cannot back an `etv_next` channel. Empty means it can. */
export function findUnsupportedSettings(
  transcodeConfig: TranscodeConfigOrm,
): UnsupportedSetting[] {
  const check = checkSupport(transcodeConfig);
  return check.supported ? [] : check.unsupported;
}

/**
 * Reports the settings a config carries that the backend has nowhere to put.
 *
 * These do not refuse the config. The channel still streams; it streams
 * without them, so a user who tuned a preset or a volume trim is told rather
 * than left to wonder why it stopped mattering.
 *
 * Reads the same two sources `toChannelConfig` does, because whether scaling
 * is ignored is a global ffmpeg setting rather than a per-config one.
 */
export function findIgnoredSettings({
  transcodeConfig,
  ffmpegSettings,
}: {
  transcodeConfig: TranscodeConfigOrm;
  ffmpegSettings: Pick<MappedFfmpegSettings, 'scalingAlgorithm'>;
}): IgnoredSetting[] {
  const ignored: IgnoredSetting[] = [];
  const note = (field: string, reason: string) =>
    ignored.push({ field, reason });

  if (transcodeConfig.threadCount !== 0) {
    note('threadCount', 'the backend does not expose a thread count');
  }
  if (transcodeConfig.videoPreset !== null) {
    note('videoPreset', 'the backend has no encoder preset surface yet');
  }
  if (transcodeConfig.videoProfile !== null) {
    note('videoProfile', 'the backend has no encoder profile surface yet');
  }
  if (transcodeConfig.audioVolumePercent !== 100) {
    note('audioVolumePercent', 'the backend has no volume filter');
  }
  if (transcodeConfig.normalizeFrameRate === true) {
    note('normalizeFrameRate', 'the backend does not normalize frame rate');
  }
  if (ffmpegSettings.scalingAlgorithm !== 'fast_bilinear') {
    note(
      'scalingAlgorithm',
      'the backend hardcodes fast_bilinear for software scaling',
    );
  }

  // Only meaningful under an accel mode the backend understands; a driver
  // named beside software encoding was never going to be read.
  const usesAccel =
    transcodeConfig.hardwareAccelerationMode !== 'none' &&
    isSupportedAccel(transcodeConfig.hardwareAccelerationMode);

  if (
    usesAccel &&
    !isSupportedVaapiDriver(transcodeConfig.vaapiDriver) &&
    transcodeConfig.vaapiDriver !== 'system'
  ) {
    note(
      'vaapiDriver',
      `${transcodeConfig.vaapiDriver} has no counterpart in the backend`,
    );
  }

  return ignored;
}

/**
 * Builds the `channel.json` a worker is spawned with.
 *
 * Tunarr has no per-channel config deltas — `channel.transcodeConfigId` points
 * at a shared named row — so one document is composed per spawn from that row
 * plus the global ffmpeg settings. There are no overlay files.
 *
 * Deinterlacing reads from both: whether to do it is per-config
 * (`deinterlaceVideo`), which filter to use is global (`deinterlaceFilter`).
 *
 * @throws UnsupportedTranscodeConfigError when the config names a codec the
 * backend cannot produce. Callers validate at assign time so this never fires
 * mid-stream.
 */
export function toChannelConfig({
  transcodeConfig,
  ffmpegSettings,
  playoutFolder,
}: {
  transcodeConfig: TranscodeConfigOrm;
  ffmpegSettings: MappedFfmpegSettings;
  playoutFolder: string;
}): ChannelConfigMapping {
  const check = checkSupport(transcodeConfig);
  if (!check.supported) {
    throw new UnsupportedTranscodeConfigError(check.unsupported);
  }
  const { videoFormat, audioFormat, accel } = check.codecs;

  const ignored = findIgnoredSettings({ transcodeConfig, ffmpegSettings });
  const usesAccel = accel !== undefined;

  // `system` means "let the driver decide", which is the same as omitting it.
  // `nouveau` has no counterpart, so it is dropped rather than substituted.
  const vaapiDriver = isSupportedVaapiDriver(transcodeConfig.vaapiDriver)
    ? transcodeConfig.vaapiDriver
    : undefined;

  const deinterlace = transcodeConfig.deinterlaceVideo === true;
  const filters = deinterlace
    ? deinterlaceFilters[ffmpegSettings.deinterlaceFilter]
    : undefined;

  const config: ChannelConfig = {
    ffmpeg: {
      ffmpeg_path: ffmpegSettings.ffmpegExecutablePath,
      ffprobe_path: ffmpegSettings.ffprobeExecutablePath,
    },
    normalization: {
      video: {
        format: videoFormat,
        width: transcodeConfig.resolution.widthPx,
        height: transcodeConfig.resolution.heightPx,
        bitrate_kbps: transcodeConfig.videoBitRate,
        buffer_kbps: transcodeConfig.videoBufferSize,
        deinterlace,

        // The backend rejects a config at spawn when a video format is set and
        // bit_depth is not, an invariant its JSON Schema leaves optional. Tunarr
        // allows null, so fall back to 8 rather than emitting a config that
        // parses here and fails there.
        bit_depth: transcodeConfig.videoBitDepth ?? 8,

        ...(usesAccel ? { accel } : {}),
        ...(usesAccel && transcodeConfig.vaapiDevice !== null
          ? { vaapi_device: transcodeConfig.vaapiDevice }
          : {}),
        ...(usesAccel && vaapiDriver !== undefined
          ? { vaapi_driver: vaapiDriver }
          : {}),
        ...(filters !== undefined ? { filters } : {}),
      },
      audio: {
        format: audioFormat,
        bitrate_kbps: transcodeConfig.audioBitRate,
        buffer_kbps: transcodeConfig.audioBufferSize,
        channels: transcodeConfig.audioChannels,

        // Tunarr stores kilohertz and emits `-ar 48k`; the backend passes this
        // field to ffmpeg as a raw hertz value.
        sample_rate_hz: transcodeConfig.audioSampleRate * 1000,
        ...(transcodeConfig.audioLoudnormConfig !== null
          ? {
              normalize_loudness: true,
              loudness: {
                integrated_target: transcodeConfig.audioLoudnormConfig.i,
                range_target: transcodeConfig.audioLoudnormConfig.lra,
                true_peak: transcodeConfig.audioLoudnormConfig.tp,
              },
            }
          : {}),
      },
    },
    playout: {
      folder: playoutFolder,
    },
    fallback: {
      // Tunarr emits its own error and offline items through the resolver, so
      // the backend's card is a last-resort net. Burning the reason into frame
      // is what makes an otherwise silent fallback diagnosable.
      show_error: transcodeConfig.errorScreen !== 'blank',
    },
  };

  const { transcodeDirectory } = ffmpegSettings;
  if (ffmpegSettings.enableFileLogging && transcodeDirectory !== undefined) {
    config.ffmpeg.reports_folder = transcodeDirectory;
  }

  return { config: ChannelConfigSchema.parse(config), ignored };
}
