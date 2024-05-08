import { merge, trimStart } from 'lodash-es';
import { Nullable } from '../../../types/util';
import { DataProps, HardwareAccelerationMode } from '../types';
import { MarkRequired } from 'ts-essentials';

export const DefaultFfmpegState: Partial<DataProps<FfmpegState>> = {
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

type FfmpegStateFields = MarkRequired<
  Partial<DataProps<FfmpegState>>,
  'version'
>;

export class FfmpegState {
  private versionNumber: number;
  version: string;
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

  private constructor(fields: FfmpegStateFields) {
    merge(this, fields);
    // Not ideal...
    this.versionNumber = parseVersion(this.version);
  }

  static create(fields: FfmpegStateFields) {
    return new FfmpegState(fields);
  }

  static defaultWithVersion(version: string) {
    return this.create({ version });
  }

  // HACK: kinda hacky here!
  isAtLeastVersion(version: string) {
    return this.versionNumber >= parseVersion(version);
  }
}

function parseVersion(version: string): number {
  const versionNum = parseInt(trimStart(version, 'n').replaceAll('.', ''), 10);
  if (versionNum < 100) {
    versionNum * 10; // Ensure we have a 3-digit number here.
  }
  return isNaN(versionNum) ? -1 : versionNum;
}
