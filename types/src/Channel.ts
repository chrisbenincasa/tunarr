import z from 'zod';
import {
  ChannelOfflineSchema,
  ChannelSchema,
  SaveChannelRequestSchema,
  FillerCollectionSchema,
  WatermarkSchema,
  ChannelTranscodingOptionsSchema,
} from './schemas/channelSchema.js';
import { ChannelIconSchema } from './schemas/index.js';

type Alias<t> = t & { _?: never };

export type Watermark = Alias<z.infer<typeof WatermarkSchema>>;

export type FillerCollection = Alias<z.infer<typeof FillerCollectionSchema>>;

export type ChannelOffline = Alias<z.infer<typeof ChannelOfflineSchema>>;

export type ChannelIcon = Alias<z.infer<typeof ChannelIconSchema>>;

export type ChannelTranscodingOptions = Alias<
  z.infer<typeof ChannelTranscodingOptionsSchema>
>;

export type Channel = Alias<z.infer<typeof ChannelSchema>>;

export type SaveChannelRequest = Alias<
  z.infer<typeof SaveChannelRequestSchema>
>;
