import { z } from 'zod';
import {
  CacheSettingsSchema,
  LogLevelsSchema,
  LoggingSettingsSchema,
  SystemSettingsSchema,
} from '../SystemSettings.js';
import {
  ChannelProgramSchema,
  CondensedChannelProgrammingSchema,
  CondensedContentProgramSchema,
  CondensedCustomProgramSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  FlexProgramSchema,
  RedirectProgramSchema,
} from '../schemas/programmingSchema.js';
import {
  BackupSettingsSchema,
  JellyfinServerSettingsSchema,
  PlexServerSettingsSchema,
} from '../schemas/settingsSchemas.js';
import {
  RandomSlotScheduleSchema,
  TimeSlotScheduleSchema,
} from './Scheduling.js';

export * from './Scheduling.js';
export * from './plexSearch.js';

export const IdPathParamSchema = z.object({
  id: z.string(),
});

export const ChannelNumberParamSchema = z.object({
  number: z.coerce.number(),
});

export const ChannelLineupQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  includePrograms: z.coerce.boolean().default(false),
});

export const LookupExternalProgrammingSchema = z.object({
  externalId: z
    .string()
    .transform((s) => s.split('|', 3) as [string, string, string]),
});

export const BatchLookupExternalProgrammingSchema = z.object({
  externalIds: z.array(z.string()),
});

export const CreateCustomShowRequestSchema = z.object({
  name: z.string(),
  programs: z.array(
    z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
  ),
});

export type CreateCustomShowRequest = z.infer<
  typeof CreateCustomShowRequestSchema
>;

export const UpdateCustomShowRequestSchema =
  CreateCustomShowRequestSchema.partial();

export type UpdateCustomShowRequest = z.infer<
  typeof UpdateCustomShowRequestSchema
>;

export const CreateFillerListRequestSchema = z.object({
  name: z.string(),
  programs: z.array(
    z.discriminatedUnion('type', [ContentProgramSchema, CustomProgramSchema]),
  ),
});

export type CreateFillerListRequest = z.infer<
  typeof CreateFillerListRequestSchema
>;

export const UpdateFillerListRequestSchema =
  CreateFillerListRequestSchema.partial();

export type UpdateFillerListRequest = z.infer<
  typeof UpdateFillerListRequestSchema
>;

export const BasicIdParamSchema = z.object({
  id: z.string(),
});

export const BasicPagingSchema = z.object({
  offset: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});

const UpdateLineupItemSchema = z.object({
  index: z.number(),
  duration: z.number().positive().max(3.156e10).optional(), // Duration for non-content programs
});

export const ManualProgramLineupSchema = z.object({
  type: z.literal('manual'),
  programs: z.array(ChannelProgramSchema),
  lineup: z.array(UpdateLineupItemSchema), // Array of indexes into the programming array
});

export const TimeBasedProgramLineupSchema = z.object({
  type: z.literal('time'),
  // This must be the list of programs BEFORE any scheduling
  // We do this so that we can potentially create longer schedules
  // on the server-side. However, we can filter this list down to only
  // programs included in at least one time slot...
  programs: z.array(ChannelProgramSchema),
  schedule: TimeSlotScheduleSchema,
});

export const RandomSlotProgramLineupSchema = z.object({
  type: z.literal('random'),
  programs: z.array(ChannelProgramSchema),
  schedule: RandomSlotScheduleSchema,
});

export const UpdateChannelProgrammingRequestSchema: z.ZodDiscriminatedUnion<
  'type',
  [
    typeof ManualProgramLineupSchema,
    typeof TimeBasedProgramLineupSchema,
    typeof RandomSlotProgramLineupSchema,
  ]
> = z.discriminatedUnion('type', [
  ManualProgramLineupSchema,
  TimeBasedProgramLineupSchema,
  RandomSlotProgramLineupSchema,
]);

export type UpdateChannelProgrammingRequest = z.infer<
  typeof UpdateChannelProgrammingRequestSchema
>;

export const UpdateMediaSourceRequestSchema = z.discriminatedUnion('type', [
  PlexServerSettingsSchema.partial({
    sendChannelUpdates: true,
    sendGuideUpdates: true,
    clientIdentifier: true,
  }),
  JellyfinServerSettingsSchema,
]);

export type UpdateMediaSourceRequest = z.infer<
  typeof UpdateMediaSourceRequestSchema
>;

export const UpdatePlexServerRequestSchema = PlexServerSettingsSchema.partial({
  sendChannelUpdates: true,
  sendGuideUpdates: true,
  clientIdentifier: true,
  id: true,
});

export type UpdatePlexServerRequest = z.infer<
  typeof UpdatePlexServerRequestSchema
>;

export const InsertMediaSourceRequestSchema = z.discriminatedUnion('type', [
  PlexServerSettingsSchema.partial({
    sendChannelUpdates: true,
    sendGuideUpdates: true,
    index: true,
    clientIdentifier: true,
  }).omit({ id: true }),
  JellyfinServerSettingsSchema.omit({ id: true }),
]);

export type InsertMediaSourceRequest = z.infer<
  typeof InsertMediaSourceRequestSchema
>;

export const VersionApiResponseSchema = z.object({
  tunarr: z.string(),
  ffmpeg: z.string(),
  nodejs: z.string(),
});

export type VersionApiResponse = z.infer<typeof VersionApiResponseSchema>;

export const BaseErrorSchema = z.object({
  message: z.string(),
});

const FfmpegCoderDetails = z.object({
  name: z.string(),
  ffmpegName: z.string(),
});

export const FfmpegInfoResponse = z.object({
  audioEncoders: z.array(FfmpegCoderDetails),
  videoEncoders: z.array(FfmpegCoderDetails),
  hardwareAccelerationTypes: z.array(z.string()),
});

export const SystemSettingsResponseSchema = SystemSettingsSchema.extend({
  logging: LoggingSettingsSchema.extend({
    environmentLogLevel: LogLevelsSchema.optional(),
  }),
});

export type SystemSettingsResponse = z.infer<
  typeof SystemSettingsResponseSchema
>;

export const UpdateSystemSettingsRequestSchema = z.object({
  logging: LoggingSettingsSchema.pick({ logLevel: true, useEnvVarLevel: true })
    .partial()
    .optional(),
  backup: BackupSettingsSchema.optional(),
  cache: CacheSettingsSchema.optional(),
});

export type UpdateSystemSettingsRequest = z.infer<
  typeof UpdateSystemSettingsRequestSchema
>;

export const UpdateBackupSettingsRequestSchema = BackupSettingsSchema;

export const JellyfinLoginRequest = z.object({
  url: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const StreamConnectionDetailsSchema = z.object({
  ip: z.string().ip(),
  userAgent: z.string().optional(),
  lastHeartbeat: z.number().nonnegative().optional(),
});

export type StreamConnectionDetails = z.infer<
  typeof StreamConnectionDetailsSchema
>;

export const ChannelSessionsResponseSchema = z.object({
  // TODO: Share types with session
  type: z.union([
    z.literal('hls'),
    z.literal('hls_slower'),
    z.literal('mpegts'),
    z.literal('hls_concat'),
    z.literal('hls_slower_concat'),
    z.literal('mpegts_concat'),
  ]),
  state: z.string(),
  numConnections: z.number().nonnegative(),
  connections: z.array(StreamConnectionDetailsSchema),
});

export type ChannelSessionsResponse = z.infer<
  typeof ChannelSessionsResponseSchema
>;

const ContentProgramWithNoOriginalSchema = ContentProgramSchema.omit({
  originalProgram: true,
});

const CondensedChannelProgramWithNoOriginalSchema = z.discriminatedUnion(
  'type',
  [
    CondensedContentProgramSchema.omit({ originalProgram: true }),
    CondensedCustomProgramSchema.extend({
      program: CondensedContentProgramSchema.omit({
        originalProgram: true,
      }).optional(),
    }),
    RedirectProgramSchema,
    FlexProgramSchema,
  ],
);

// This is sorta hacky.
export const GetChannelProgrammingResponseSchema =
  CondensedChannelProgrammingSchema.extend({
    lineup: z.array(CondensedChannelProgramWithNoOriginalSchema),
    programs: z.record(ContentProgramWithNoOriginalSchema),
  });
