import z, { ZodTypeAny } from 'zod';
import { ResolutionSchema } from './miscSchemas.js';
import { ProgramSchema } from './programmingSchema.js';
import { ChannelIconSchema } from './utilSchemas.js';

export const WatermarkSchema = z.object({
  url: z.string().optional(),
  enabled: z.boolean(),
  position: z
    .union([
      z.literal('top-left'),
      z.literal('top-right'),
      z.literal('bottom-left'),
      z.literal('bottom-right'),
    ])
    .default('bottom-right'),
  width: z.number().positive(),
  verticalMargin: z.number().min(0).max(100),
  horizontalMargin: z.number().min(0).max(100),
  duration: z.number().min(0).default(0),
  fixedSize: z.boolean().optional(),
  animated: z.boolean().optional(),
  opacity: z.number().min(0).max(100).int().optional().catch(100).default(100),
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
  onDemand: z.object({
    enabled: z.boolean(),
  }),
  programCount: z.number(),
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
  programCount: true,
})
  .partial({
    onDemand: true,
  })
  .extend({
    transcoding: ChannelTranscodingOptionsSchema.extend({
      targetResolution: addOrTransform(ResolutionSchema.optional()),
      videoBitrate: addOrTransform(z.number().optional()),
      videoBufferSize: addOrTransform(z.number().optional()),
    }),
  });
