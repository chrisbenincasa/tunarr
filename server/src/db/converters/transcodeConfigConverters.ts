import type { TranscodeConfig } from '@tunarr/types';
import { numberToBoolean } from '../../util/sqliteUtil.ts';
import type {
  TranscodeConfig as TranscodeConfigDAO,
  TranscodeConfigOrm,
} from '../schema/TranscodeConfig.ts';

export function transcodeConfigOrmToDto(
  config: TranscodeConfigOrm,
): TranscodeConfig {
  return {
    ...config,
    id: config.uuid,
    // disableChannelOverlay: numberToBoolean(config.disableChannelOverlay),
    // normalizeFrameRate: numberToBoolean(config.normalizeFrameRate),
    // deinterlaceVideo: numberToBoolean(config.deinterlaceVideo),
    // isDefault: numberToBoolean(config.isDefault),
    // disableHardwareDecoder: numberToBoolean(config.disableHardwareDecoder),
    // disableHardwareEncoding: numberToBoolean(config.disableHardwareEncoding),
    // disableHardwareFilters: numberToBoolean(config.disableHardwareFilters),
    disableChannelOverlay: config.disableChannelOverlay ?? false,
    normalizeFrameRate: config.normalizeFrameRate ?? false,
    deinterlaceVideo: config.deinterlaceVideo ?? false,
    isDefault: config.isDefault ?? false,
    disableHardwareDecoder: config.disableHardwareDecoder ?? false,
    disableHardwareEncoding: config.disableHardwareEncoding ?? false,
    disableHardwareFilters: config.disableHardwareFilters ?? false,
  } satisfies TranscodeConfig;
}

export function legacyTranscodeConfigToDto(
  config: TranscodeConfigDAO,
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
