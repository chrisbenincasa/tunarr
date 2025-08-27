import type { TranscodeConfig } from '@tunarr/types';
import { numberToBoolean } from '../../util/sqliteUtil.ts';
import type { TranscodeConfig as TrannscodeConfigDao } from '../schema/TranscodeConfig.ts';

export function dbTranscodeConfigToApiSchema(
  config: TrannscodeConfigDao,
): TranscodeConfig {
  return {
    ...config,
    id: config.uuid,
    disableChannelOverlay: numberToBoolean(config.disableChannelOverlay),
    normalizeFrameRate: numberToBoolean(config.normalizeFrameRate),
    deinterlaceVideo: numberToBoolean(config.deinterlaceVideo),
    isDefault: numberToBoolean(config.isDefault),
    disableHardwareDecoder: numberToBoolean(config.disableHardwareDecoder),
    disableHardwareEncoding: numberToBoolean(config.disableHardwareEncoding),
    disableHardwareFilters: numberToBoolean(config.disableHardwareFilters),
  } satisfies TranscodeConfig;
}
