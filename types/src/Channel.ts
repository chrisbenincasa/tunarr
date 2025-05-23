import type z from 'zod/v4';
import type {
  ChannelOfflineSchema,
  ChannelSchema,
  ChannelSessionSchema,
  ChannelTranscodingOptionsSchema,
  CopyChannelSaveRequestSchema,
  CreateChannelRequestSchema,
  FillerCollectionSchema,
  NewChannelSaveRequestSchema,
  SaveableChannelSchema,
  WatermarkSchema,
} from './schemas/channelSchema.js';
import {
  ChannelStreamMode as ChannelStreamModesArr,
  type ChannelStreamMode as ChannelStreamModeType,
} from './schemas/channelSchema.js';
import type { ChannelIconSchema } from './schemas/index.js';

export type Watermark = z.infer<typeof WatermarkSchema>;

export type FillerCollection = z.infer<typeof FillerCollectionSchema>;

export type ChannelOffline = z.infer<typeof ChannelOfflineSchema>;

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;

export type ChannelTranscodingOptions = z.infer<
  typeof ChannelTranscodingOptionsSchema
>;

export type ChannelSession = z.infer<typeof ChannelSessionSchema>;

export type Channel = z.infer<typeof ChannelSchema>;

export type SaveableChannel = z.infer<typeof SaveableChannelSchema>;

export type NewChannelSaveRequest = z.infer<typeof NewChannelSaveRequestSchema>;

export type CopyChannelSaveRequest = z.infer<
  typeof CopyChannelSaveRequestSchema
>;

export type CreateChannelRequest = z.infer<typeof CreateChannelRequestSchema>;

export const ChannelStreamModes = ChannelStreamModesArr;

export type ChannelStreamMode = ChannelStreamModeType;
