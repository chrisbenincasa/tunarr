import type { TranscodeConfig } from '@tunarr/types';
import type { TranscodeConfigOrm } from '../schema/TranscodeConfig.ts';

export function transcodeConfigOrmToDto(
  config: TranscodeConfigOrm,
): TranscodeConfig {
  return {
    ...config,
    id: config.uuid,
    disableChannelOverlay: config.disableChannelOverlay ?? false,
    normalizeFrameRate: config.normalizeFrameRate ?? false,
    deinterlaceVideo: config.deinterlaceVideo ?? false,
    isDefault: config.isDefault ?? false,
    disableHardwareDecoder: config.disableHardwareDecoder ?? false,
    disableHardwareEncoding: config.disableHardwareEncoding ?? false,
    disableHardwareFilters: config.disableHardwareFilters ?? false,
  } satisfies TranscodeConfig;
}
