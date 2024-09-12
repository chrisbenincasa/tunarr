import { merge, trimStart } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { Nullable } from '../../../types/util';
import { OutputFormats } from '../constants';
import { DataProps, HardwareAccelerationMode } from '../types';

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
  outputFormat: (typeof OutputFormats)[keyof typeof OutputFormats];

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
  const versionNum = parseInt(
    trimStart(version, 'n')
      .replaceAll(/ubuntu[0-9.]+$/g, '')
      .replaceAll('.', '')
      .replace(/-.+$/, ''),
    10,
  );
  if (versionNum < 100) {
    versionNum * 10; // Ensure we have a 3-digit number here.
  }
  return isNaN(versionNum) ? -1 : versionNum;
}
