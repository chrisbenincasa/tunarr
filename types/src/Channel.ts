import z from 'zod';
import {
  ChannelOfflineSchema,
  ChannelSchema,
  ChannelStreamMode as ChannelStreamModesArr,
  ChannelTranscodingOptionsSchema,
  FillerCollectionSchema,
  SaveChannelRequestSchema,
  WatermarkSchema,
  type ChannelStreamMode as ChannelStreamModeType,
} from './schemas/channelSchema.js';
import { ChannelIconSchema } from './schemas/index.js';

export type Watermark = z.infer<typeof WatermarkSchema>;

export type FillerCollection = z.infer<typeof FillerCollectionSchema>;

export type ChannelOffline = z.infer<typeof ChannelOfflineSchema>;

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;

export type ChannelTranscodingOptions = z.infer<
  typeof ChannelTranscodingOptionsSchema
>;

export type Channel = z.infer<typeof ChannelSchema>;

export type SaveChannelRequest = z.infer<typeof SaveChannelRequestSchema>;

export const ChannelStreamModes = ChannelStreamModesArr;

export type ChannelStreamMode = ChannelStreamModeType;
