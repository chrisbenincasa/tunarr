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
  disableFillerOverlay: z.boolean(),
  duration: z.number(),
  fallback: z.array(ProgramSchema).optional(),
  fillerCollections: z.array(FillerCollectionSchema).optional(),
  fillerRepeatCooldown: z.number().optional(),
  groupTitle: z.string(),
  guideFlexPlaceholder: z.string().optional(),
  guideMinimumDuration: z.number(),
  icon: ChannelIconSchema,
  id: z.string(),
  name: z.string(),
  number: z.number(),
  offline: ChannelOfflineSchema,
  programs: z.array(ProgramSchema),
  startTime: z.number(),
  stealth: z.boolean(),
  transcoding: ChannelTranscodingOptionsSchema.optional(),
  watermark: WatermarkSchema.optional(),
});

export const SaveChannelRequestSchema = ChannelSchema.omit({
  programs: true,
  // fillerCollections: true,
  fallback: true, // Figure out how to update this
});
// .extend({
//   fillerCollections: z.array(z.string()),
// });
