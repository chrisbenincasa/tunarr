import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { DataProps } from '@/ffmpeg/builder/types.js';
import type { FfmpegVersionResult } from '@/ffmpeg/ffmpegInfo.js';
import type { Maybe, Nullable } from '@/types/util.js';
import type { FfmpegLogLevel } from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import { merge } from 'lodash-es';
import path from 'node:path';
import type { MarkRequired } from 'ts-essentials';
import type { OutputFormat } from '../constants.ts';
import {
  MpegTsOutputFormat,
  OutputFormatTypes,
  OutputLocation,
} from '../constants.ts';

export type PipelineOptions = {
  decoderThreadCount: Nullable<number>;
  encoderThreadCount: Nullable<number>;
  filterThreadCount: Nullable<number>;
  disableHardwareDecoding?: boolean;
  disableHardwareEncoding?: boolean;
  disableHardwareFilters?: boolean;
  vaapiDevice: Nullable<string>;
  vaapiDriver: Nullable<string>;
};

export const DefaultPipelineOptions: PipelineOptions = {
  decoderThreadCount: null,
  encoderThreadCount: null,
  filterThreadCount: null,
  disableHardwareDecoding: false,
  disableHardwareEncoding: false,
  disableHardwareFilters: false,
  vaapiDevice: null,
  vaapiDriver: null,
};

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
  readonly version: FfmpegVersionResult;

  threadCount: Nullable<number> = null;
  start: Nullable<Duration> = null;
  duration: Nullable<Duration> = null;
  logLevel: FfmpegLogLevel = 'error';
  // metadata
  mapMetadata: boolean = false;
  doNotMapMetadata: boolean;
  metadataServiceName: Nullable<string> = null;
  metadataServiceProvider: Nullable<string> = null;
  decoderHwAccelMode: HardwareAccelerationMode = HardwareAccelerationMode.None;
  encoderHwAccelMode: HardwareAccelerationMode = HardwareAccelerationMode.None;

  softwareScalingAlgorithm: string = 'fast_bilinear';
  softwareDeinterlaceFilter: string = 'yadif=1';
  vaapiDevice: Nullable<string> = null;
  vaapiDriver: Nullable<string> = null;
  outputFormat: OutputFormat = MpegTsOutputFormat; // TODO: No
  outputLocation: OutputLocation = OutputLocation.Stdout;
  ptsOffset?: number;

  // HLS
  get hlsPlaylistPath(): Maybe<string> {
    if (this.outputFormat.type === OutputFormatTypes.Hls) {
      return path.join(
        this.outputFormat.hlsOptions.segmentBaseDirectory,
        this.outputFormat.hlsOptions.streamBasePath,
        this.outputFormat.hlsOptions.streamNameFormat,
      );
    }
    return;
  }

  get hlsSegmentTemplate(): Maybe<string> {
    if (this.outputFormat.type === OutputFormatTypes.Hls) {
      return path.join(
        this.outputFormat.hlsOptions.segmentBaseDirectory,
        this.outputFormat.hlsOptions.streamBasePath,
        this.outputFormat.hlsOptions.segmentNameFormat,
      );
    }
    return;
  }

  get hlsBaseStreamUrl() {
    if (this.outputFormat.type === OutputFormatTypes.Hls) {
      return this.outputFormat.hlsOptions.streamBaseUrl;
    }
    return;
  }

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
}
