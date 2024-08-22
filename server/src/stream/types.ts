import { Channel } from '../dao/entities/Channel.js';
import { TupleToUnion } from '../types/util.js';

export const STREAM_CHANNEL_CONTEXT_KEYS = [
  'disableFillerOverlay',
  'watermark',
  'icon',
  'offlinePicture',
  'offlineSoundtrack',
  'name',
  'transcoding',
  'number',
  'uuid',
] as const;

export type StreamContextChannel = Pick<
  Channel & { offlinePicture?: string; offlineSoundtrack?: string },
  TupleToUnion<typeof STREAM_CHANNEL_CONTEXT_KEYS>
>;
export type StreamDetails = {
  duration?: number;
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
