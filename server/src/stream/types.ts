import { Duration } from 'dayjs/plugin/duration.js';

export type StreamDetails = {
  duration?: Duration;
  anamorphic?: boolean;
  pixelP?: number;
  pixelQ?: number;

  videoCodec?: string;
  videoWidth?: number;
  videoHeight?: number;
  videoFramerate?: number;
  videoDecision?: string;
  videoScanType?: string;
  videoBitDepth?: number;
  videoStreamIndex?: string;

  audioDecision?: string;
  audioOnly?: boolean;
  audioChannels?: number;
  audioCodec?: string;
  audioIndex?: string;

  placeholderImage?: string;

  serverPath?: string;
  directFilePath?: string;
};

export type HttpStreamSource = {
  type: 'http';
  streamUrl: string;
  extraHeaders?: Record<string, string>;
};

export type FileStreamSource = {
  type: 'file';
  path: string;
};

export type OfflineStreamSource = {
  type: 'offline';
};

export type ErrorStreamSource = {
  type: 'error';
  title: string;
  subtitle?: string;
};

export type StreamSource =
  | FileStreamSource
  | HttpStreamSource
  | OfflineStreamSource
  | ErrorStreamSource;

export type ProgramStream = {
  streamSource: StreamSource;
  streamDetails?: StreamDetails;
};
