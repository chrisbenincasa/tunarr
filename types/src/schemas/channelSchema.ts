import z, { ZodTypeAny } from 'zod';
import { ResolutionSchema } from './miscSchemas.js';
import { ProgramSchema } from './programmingSchema.js';
import { ChannelIconSchema } from './utilSchemas.js';

export const WatermarkSchema = z.object({
  url: z.string().optional(),
  enabled: z.boolean(),
  position: z.union([
    z.literal('top-left'),
    z.literal('top-right'),
    z.literal('bottom-left'),
    z.literal('bottom-right'),
  ]),
  width: z.number(),
  verticalMargin: z.number(),
  horizontalMargin: z.number(),
  duration: z.number(),
  fixedSize: z.boolean().optional(),
  animated: z.boolean().optional(),
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
  targetResolution: ResolutionSchema.optional(),
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
  guideFlexTitle: z.string().optional(),
  guideMinimumDuration: z.number(),
  icon: ChannelIconSchema,
  id: z.string(),
  name: z.string(),
  number: z.number(),
  offline: ChannelOfflineSchema,
  startTime: z.number(),
  stealth: z.boolean(),
  transcoding: ChannelTranscodingOptionsSchema.optional(),
  watermark: WatermarkSchema.optional(),
});

function addOrTransform<T extends ZodTypeAny>(x: T) {
  return x.or(z.literal('global')).transform((val) => {
    if (val === 'global') {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return val;
  });
}

export const SaveChannelRequestSchema = ChannelSchema.omit({
  programs: true,
  fallback: true, // Figure out how to update this
}).extend({
  transcoding: ChannelTranscodingOptionsSchema.extend({
    targetResolution: addOrTransform(ResolutionSchema.optional()),
    videoBitrate: addOrTransform(z.number().optional()),
    videoBufferSize: addOrTransform(z.number().optional()),
  }),
});
