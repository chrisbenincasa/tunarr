import z from 'zod';
import { ResolutionSchema } from './miscSchemas.js';
import { ProgramSchema } from './programmingSchema.js';

export const ChannelIconSchema = z.object({
  path: z.string(),
  width: z.number(),
  duration: z.number(),
  position: z.string(),
});

export const WatermarkSchema = z.object({
  url: z.string().optional(),
  enabled: z.boolean(),
  position: z.string(),
  width: z.number(),
  verticalMargin: z.number(),
  horizontalMargin: z.number(),
  duration: z.number(),
  fixedSize: z.boolean(),
  animated: z.boolean(),
});

export const FillerCollectionSchema = z.object({
  id: z.string(),
  weight: z.number(),
  cooldownSeconds: z.number(),
});

export const ChannelOfflineSchema = z.object({
  picture: z.string().optional(),
  soundtrack: z.string().optional(),
  mode: z.string(),
});

export const ChannelTranscodingOptionsSchema = z.object({
  targetResolution: ResolutionSchema,
  videoBitrate: z.number().optional(),
  videoBufferSize: z.number().optional(),
});

export const ChannelSchema = z.object({
  number: z.number(),
  watermark: WatermarkSchema.optional(),
  fillerCollections: z.array(FillerCollectionSchema).optional(),
  programs: z.array(ProgramSchema),
  icon: ChannelIconSchema,
  guideMinimumDurationSeconds: z.number(),
  groupTitle: z.string(),
  disableFillerOverlay: z.boolean(),
  startTimeEpoch: z.number(),
  offline: ChannelOfflineSchema,
  name: z.string(),
  transcoding: ChannelTranscodingOptionsSchema.optional(),
  duration: z.number(),
  fallback: z.array(ProgramSchema).optional(),
  stealth: z.boolean(),
  guideFlexPlaceholder: z.string().optional(),
  fillerRepeatCooldown: z.number().optional(),
});
