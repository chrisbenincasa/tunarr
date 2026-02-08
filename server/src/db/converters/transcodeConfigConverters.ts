import type { TranscodeConfig } from '@tunarr/types';
import type { TranscodeConfigOrm } from '../schema/TranscodeConfig.ts';

export function dbTranscodeConfigToApiSchema(
  config: TranscodeConfigOrm,
): TranscodeConfig {
  return {
    ...config,
    id: config.uuid,
    normalizeFrameRate: config.normalizeFrameRate ?? false,
    deinterlaceVideo: config.deinterlaceVideo ?? false,
    disableChannelOverlay: config.disableChannelOverlay ?? false,
    disableHardwareDecoder: config.disableHardwareDecoder ?? false,
    disableHardwareEncoding: config.disableHardwareEncoding ?? false,
    disableHardwareFilters: config.disableHardwareFilters ?? false,
    audioLoudnormConfig: config.audioLoudnormConfig ?? undefined,
  } satisfies TranscodeConfig;
}
