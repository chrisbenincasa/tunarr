import { merge } from 'lodash-es';
import { Nullable } from '../../../types/util';
import { DataProps, HardwareAccelerationMode } from '../types';

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

export class FfmpegState {
  threadCount: Nullable<number> = null;
  start: Nullable<string> = null;
  finish: Nullable<string> = null;
  mapMetadata: boolean = false;
  // metadata
  decoderHwAccelMode: HardwareAccelerationMode = 'none';
  encoderHwAccelMode: HardwareAccelerationMode = 'none';
  softwareScalingAlgorithm: string = 'fast_bilinear';
  softwareDeinterlaceFilter: string = 'yadif=1';
  vaapiDevice: Nullable<string> = null;

  private constructor(fields: Partial<DataProps<FfmpegState>> = {}) {
    merge(this, fields);
  }

  static create(fields: Partial<DataProps<FfmpegState>> = {}) {
    return new FfmpegState(fields);
  }
}
