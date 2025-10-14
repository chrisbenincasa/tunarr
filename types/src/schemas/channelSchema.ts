import z from 'zod/v4';
import type { TupleToUnion } from '../util.js';
import { ResolutionSchema } from './miscSchemas.js';
import { ProgramSchema } from './programmingSchema.js';
import { SubtitlePreference } from './subtitleSchema.js';
import { ChannelIconSchema, ContentProgramTypeSchema } from './utilSchemas.js';

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
  fadeConfig: z
    .array(
      z.object({
        programType: ContentProgramTypeSchema.optional().catch(undefined),
        // Encodes on/off period of displaying the watermark in mins.
        // e.g. a 5m period fades in the watermark every 5th min and displays it
        // for 5 mins.
        periodMins: z.number().positive().min(1),
        // If true, the watermark will fade in immediately on channel stream start.
        // If false, the watermark will start not visible and fade in after periodMins.
        leadingEdge: z.boolean().optional().catch(true),
      }),
    )
    .optional(),
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

export const HlsChannelStreamMode = 'hls';
export const HlsConcatChannelStreamMode = 'hls_concat';
export const HlsSlowerChannelStreamMode = 'hls_slower';
export const HlsSlowerConcatChannelStreamMode = 'hls_slower_concat';
export const MpegTsChannelStreamMode = 'mpegts';
export const MpegTsConcatChannelStreamMode = 'mpegts_concat';
export const HlsSDirectStreamMode = 'hls_direct';
export const HlsSDirectConcatStreamMode = 'hls_direct_concat';

export const ChannelStreamMode = {
  Hls: HlsChannelStreamMode,
  HlsSlower: HlsSlowerChannelStreamMode,
  MpegTs: MpegTsChannelStreamMode,
  HlsDirect: HlsSDirectStreamMode,
} as const;

export const ChannelConcatStreamMode = {
  Hls: HlsConcatChannelStreamMode,
  HlsSlower: HlsSlowerConcatChannelStreamMode,
  MpegTs: MpegTsConcatChannelStreamMode,
  HlsDirect: HlsSDirectConcatStreamMode,
} as const;

export const ChannelStreamModes = [
  ChannelStreamMode.Hls,
  ChannelStreamMode.HlsSlower,
  ChannelStreamMode.MpegTs,
  ChannelStreamMode.HlsDirect,
] as const;

export const ChannelConcatStreamModes = [
  ChannelConcatStreamMode.Hls,
  ChannelConcatStreamMode.HlsSlower,
  ChannelConcatStreamMode.MpegTs,
  ChannelConcatStreamMode.HlsDirect,
] as const;

export type ChannelStreamMode = TupleToUnion<typeof ChannelStreamModes>;
export const ChannelStreamModeSchema = z.enum(ChannelStreamModes);

export type ChannelConcatStreamMode = TupleToUnion<
  typeof ChannelConcatStreamModes
>;
export const ChannelConcatStreamModeSchema = z.enum(ChannelConcatStreamModes);

export const StreamConnectionDetailsSchema = z.object({
  ip: z.ipv4().or(z.ipv6()),
  userAgent: z.string().optional(),
  lastHeartbeat: z.number().nonnegative().optional(),
});

export const ChannelSessionSchema = z.object({
  type: z.enum([...ChannelStreamModes, ...ChannelConcatStreamModes]),
  state: z.string(),
  numConnections: z.number().nonnegative(),
  connections: z.array(StreamConnectionDetailsSchema),
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
  streamMode: ChannelStreamModeSchema,
  transcodeConfigId: z.string(),
  sessions: z.array(ChannelSessionSchema).optional(),
  subtitlesEnabled: z.boolean(),
  subtitlePreferences: z.array(SubtitlePreference).nonempty().optional(),
});

export const SaveableChannelSchema = ChannelSchema.omit({
  fallback: true, // Figure out how to update this
  programCount: true,
  transcoding: true,
  sessions: true,
}).partial({
  onDemand: true,
});

export const NewChannelSaveRequestSchema = z.object({
  type: z.literal('new'),
  channel: SaveableChannelSchema,
});

export const CopyChannelSaveRequestSchema = z.object({
  type: z.literal('copy'),
  channelId: z.string().uuid(),
});

export const CreateChannelRequestSchema = z.discriminatedUnion('type', [
  NewChannelSaveRequestSchema,
  CopyChannelSaveRequestSchema,
]);
