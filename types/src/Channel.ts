import z from 'zod';
import {
  ChannelOfflineSchema,
  ChannelSchema,
  UpdateChannelRequestSchema,
  FillerCollectionSchema,
  WatermarkSchema,
} from './schemas/channelSchema.js';
import { ChannelIconSchema } from './schemas/index.js';

type Alias<t> = t & { _?: never };

export type Watermark = Alias<z.infer<typeof WatermarkSchema>>;

export type FillerCollection = Alias<z.infer<typeof FillerCollectionSchema>>;

export type ChannelOffline = Alias<z.infer<typeof ChannelOfflineSchema>>;

export type ChannelIcon = Alias<z.infer<typeof ChannelIconSchema>>;

export type Channel = Alias<z.infer<typeof ChannelSchema>>;

export type UpdateChannelRequest = Alias<
  z.infer<typeof UpdateChannelRequestSchema>
>;
