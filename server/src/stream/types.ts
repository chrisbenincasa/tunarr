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
