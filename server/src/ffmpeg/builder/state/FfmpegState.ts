import type { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { DataProps } from '@/ffmpeg/builder/types.js';
import type { FfmpegVersionResult } from '@/ffmpeg/ffmpegInfo.js';
import type { Nullable } from '@/types/util.js';
import type { FfmpegLogLevel } from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import { isNil, merge } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import type { OutputFormat } from '../constants.ts';
import { MpegTsOutputFormat, OutputLocation } from '../constants.ts';

export const DefaultFfmpegState: Partial<DataProps<FfmpegState>> = {
  threadCount: null,
  start: null,
  duration: null,
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
  version: FfmpegVersionResult;
  threadCount: Nullable<number> = null;
  start: Nullable<Duration> = null;
  duration: Nullable<Duration> = null;
  logLevel: FfmpegLogLevel = 'error';
  // metadata
  mapMetadata: boolean = false;
  doNotMapMetadata: boolean;
  metadataServiceName: Nullable<string> = null;
  metadataServiceProvider: Nullable<string> = null;

  decoderHwAccelMode: HardwareAccelerationMode = 'none';
  encoderHwAccelMode: HardwareAccelerationMode = 'none';
  softwareScalingAlgorithm: string = 'fast_bilinear';
  softwareDeinterlaceFilter: string = 'yadif=1';
  vaapiDevice: Nullable<string> = null;
  vaapiDriver: Nullable<string> = null;
  outputFormat: OutputFormat = MpegTsOutputFormat; // TODO: No
  outputLocation: OutputLocation = OutputLocation.Stdout;
  ptsOffset?: number;

  private constructor(fields: FfmpegStateFields) {
    merge(this, fields);
  }

  static create(fields: FfmpegStateFields) {
    return new FfmpegState(fields);
  }

  static forConcat(
    version: FfmpegVersionResult,
    channelName: string,
    outputFormat: OutputFormat = MpegTsOutputFormat,
  ) {
    return this.create({
      version,
      doNotMapMetadata: true,
      metadataServiceProvider: 'Tunarr',
      metadataServiceName: channelName,
      outputFormat,
      ptsOffset: 0,
    });
  }

  static defaultWithVersion(version: FfmpegVersionResult) {
    return this.create({ version });
  }

  // HACK: kinda hacky here!
  isAtLeastVersion(
    version: { major: number; minor?: number },
    permissive: boolean = true,
  ) {
    if (this.version.isUnknown || isNil(this.version.majorVersion)) {
      return permissive;
    }

    const { major, minor } = version;

    if (this.version.majorVersion > major) {
      return true;
    }

    if (this.version.majorVersion === major) {
      if (isNil(this.version.minorVersion)) {
        return permissive;
      }

      // We're not looking for a minor version
      if (isNil(minor)) {
        return true;
      }

      return this.version.minorVersion >= minor;
    }

    return false;
  }
}
