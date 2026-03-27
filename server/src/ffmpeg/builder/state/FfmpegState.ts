import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { FfmpegVersionResult } from '@/ffmpeg/ffmpegInfo.js';
import type { DataProps, Maybe, Nullable } from '@/types/util.js';
import type { TupleToUnion } from '@tunarr/types';
import type { FfmpegLogLevel } from '@tunarr/types/schemas';
import type { Duration } from 'dayjs/plugin/duration.js';
import { merge } from 'lodash-es';
import path from 'node:path';
import type { MarkRequired } from 'ts-essentials';
import type { OutputFormat, OutputLocation } from '../constants.ts';
import {
  MpegTsOutputFormat,
  OutputFormatTypes,
  StdoutOutputLocation,
} from '../constants.ts';

export const VaapiTonemapType = ['vaapi', 'opencl'] as const;
export type VaapiTonemapType = TupleToUnion<typeof VaapiTonemapType>;

export type VaapiPipelineOptions = {
  // Ordered list of preferred tonemap types. Pipeline will cross
  // reference the list based on what is available on the system.
  tonemapPreference: VaapiTonemapType;
};

export type PipelineOptions = {
  decoderThreadCount: Nullable<number>;
  encoderThreadCount: Nullable<number>;
  filterThreadCount: Nullable<number>;
  disableHardwareDecoding?: boolean;
  disableHardwareEncoding?: boolean;
  disableHardwareFilters?: boolean;
  // TODO: Move these into the vaapi pipeline options
  vaapiDevice: Nullable<string>;
  vaapiDriver: Nullable<string>;
  // VAAPI
  vaapiPipelineOptions: Nullable<VaapiPipelineOptions>;
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
  vaapiPipelineOptions: {
    tonemapPreference: 'opencl',
  },
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
  outputLocation: OutputLocation = StdoutOutputLocation;
  ptsOffset?: number;
  tonemapHdr: boolean = false;

  // HLS
  get hlsPlaylistPath(): Maybe<string> {
    if (
      this.outputFormat.type === OutputFormatTypes.Hls ||
      this.outputFormat.type === OutputFormatTypes.HlsDirectV2
    ) {
      return path.join(
        this.outputFormat.hlsOptions.segmentBaseDirectory,
        this.outputFormat.hlsOptions.streamBasePath,
        this.outputFormat.hlsOptions.streamNameFormat,
      );
    }
    return;
  }

  get hlsSegmentTemplate(): Maybe<string> {
    if (
      this.outputFormat.type === OutputFormatTypes.Hls ||
      this.outputFormat.type === OutputFormatTypes.HlsDirectV2
    ) {
      return path.join(
        this.outputFormat.hlsOptions.segmentBaseDirectory,
        this.outputFormat.hlsOptions.streamBasePath,
        this.outputFormat.hlsOptions.segmentNameFormat,
      );
    }
    return;
  }

  get hlsBaseStreamUrl() {
    if (
      this.outputFormat.type === OutputFormatTypes.Hls ||
      this.outputFormat.type === OutputFormatTypes.HlsDirectV2
    ) {
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
