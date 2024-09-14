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
  videoSampleAspectRatio?: string;
  videoDisplayAspectRatio?: number;
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

export type PlexStream = {
  directPlay: boolean;
  streamUrl: string;
  separateVideoStream?: string;
  streamDetails?: StreamDetails;
};
