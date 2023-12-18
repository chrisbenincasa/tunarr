import z from 'zod';
import {
  ChannelIconSchema,
  ChannelOfflineSchema,
  ChannelSchema,
  CreateChannelSchema,
  FillerCollectionSchema,
  WatermarkSchema,
} from './schemas/channelSchema.js';

type Alias<t> = t & { _?: never };

export type Watermark = Alias<z.infer<typeof WatermarkSchema>>;

export type FillerCollection = Alias<z.infer<typeof FillerCollectionSchema>>;

export type ChannelOffline = Alias<z.infer<typeof ChannelOfflineSchema>>;

export type ChannelIcon = Alias<z.infer<typeof ChannelIconSchema>>;

export type Channel = Alias<z.infer<typeof ChannelSchema>>;

export type CreateChannelRequest = Alias<z.infer<typeof CreateChannelSchema>>;
