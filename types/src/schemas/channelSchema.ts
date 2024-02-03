import z from 'zod';
import { ResolutionSchema } from './miscSchemas.js';
import { ProgramSchema } from './programmingSchema.js';
import { ChannelIconSchema } from './utilSchemas.js';

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
  mode: z.union([z.literal('pic'), z.literal('clip')]),
});

export const ChannelTranscodingOptionsSchema = z.object({
  targetResolution: ResolutionSchema,
  videoBitrate: z.number().optional(),
  videoBufferSize: z.number().optional(),
});

export const ChannelSchema = z.object({
  id: z.string(),
  number: z.number(),
  watermark: WatermarkSchema.optional(),
  fillerCollections: z.array(FillerCollectionSchema).optional(),
  programs: z.array(ProgramSchema),
  icon: ChannelIconSchema,
  guideMinimumDurationSeconds: z.number(),
  groupTitle: z.string(),
  disableFillerOverlay: z.boolean(),
  startTime: z.number(),
  offline: ChannelOfflineSchema,
  name: z.string(),
  transcoding: ChannelTranscodingOptionsSchema.optional(),
  duration: z.number(),
  fallback: z.array(ProgramSchema).optional(),
  stealth: z.boolean(),
  guideFlexPlaceholder: z.string().optional(),
  fillerRepeatCooldown: z.number().optional(),
});

export const SaveChannelRequestSchema = ChannelSchema.omit({
  programs: true,
  // fillerCollections: true,
  fallback: true, // Figure out how to update this
});
// .extend({
//   fillerCollections: z.array(z.string()),
// });
