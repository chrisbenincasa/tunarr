import { Nullable } from '../../../types/util';
import { HardwareAccelerationMode } from '../types';

export type FfmpegState = {
  threadCount: Nullable<number>;
  start: Nullable<string>;
  finish: Nullable<string>;
  mapMetadata: boolean;
  // metadata
  decoderHwAccelMode: HardwareAccelerationMode;
  encoderHwAccelMode: HardwareAccelerationMode;
  softwareScalingAlgorithm: string;
  softwareDeinterlaceFilter: string;
  vaapiDevice: Nullable<string>;
};

export const DefaultFfmpegState: FfmpegState = {
  threadCount: null,
  start: null,
  finish: null,
  mapMetadata: false,
  decoderHwAccelMode: 'none',
  encoderHwAccelMode: 'none',
  softwareScalingAlgorithm: 'fast_bilinear',
  softwareDeinterlaceFilter: 'yadif=1',
  vaapiDevice: null,
};
