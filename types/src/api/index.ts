import { z } from 'zod/v4';
import {
  CacheSettingsSchema,
  LoggingSettingsSchema,
  LogLevelsSchema,
  ServerSettingsSchema,
  SystemSettingsSchema,
} from '../SystemSettings.js';
import { JellyfinItemFields, JellyfinItemKind } from '../jellyfin/index.js';
import {
  ChannelConcatStreamModes,
  ChannelStreamModes,
} from '../schemas/channelSchema.js';
import {
  ChannelProgramSchema,
  CondensedChannelProgrammingSchema,
  CondensedChannelProgramSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  MusicAlbumContentProgramSchema,
  TvSeasonContentProgramSchema,
} from '../schemas/programmingSchema.js';
import {
  BackupSettingsSchema,
  EmbyServerSettingsSchema,
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

export function PagedResult<T extends z.ZodType>(schema: T) {
  return z.object({
    total: z.number(),
    result: schema,
  });
}

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

const LineupLookupItemSchema = z.object({
  type: z.literal('index'),
  index: z.number(),
  duration: z.number().positive().max(3.156e10).optional(), // Duration for non-content programs
});

const PersistedLineupItemSchema = z.object({
  type: z.literal('persisted'),
  programId: z.string(),
  customShowId: z.string().optional(),
  // Include this for now just to make the server-side stuff
  // a bit easier. Eventually we'll do a big lookup and use the
  // saved durations from the DB.
  duration: z.number().positive().max(3.156e10),
});

const UpdateLineupItemSchema = z.union([
  LineupLookupItemSchema,
  PersistedLineupItemSchema,
]);

export const ManualProgramLineupSchema = z.object({
  type: z.literal('manual'),
  programs: z.array(ChannelProgramSchema),
  lineup: z.array(UpdateLineupItemSchema), // Array of indexes into the programming array
  append: z.boolean().default(false),
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

export const UpdateChannelProgrammingRequestSchema = z.discriminatedUnion(
  'type',
  [
    ManualProgramLineupSchema,
    TimeBasedProgramLineupSchema,
    RandomSlotProgramLineupSchema,
  ],
);

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
  EmbyServerSettingsSchema,
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
  EmbyServerSettingsSchema.omit({ id: true }),
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
  dataDirectory: z.string(),
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
  server: ServerSettingsSchema.optional(),
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

export const EmbyLoginRequest = z.object({
  url: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
});

export const StreamConnectionDetailsSchema = z.object({
  ip: z.ipv4().or(z.ipv6()),
  userAgent: z.string().optional(),
  lastHeartbeat: z.number().nonnegative().optional(),
});

export type StreamConnectionDetails = z.infer<
  typeof StreamConnectionDetailsSchema
>;

export const ChannelSessionsResponseSchema = z.object({
  // TODO: Share types with session
  type: z.enum([...ChannelStreamModes, ...ChannelConcatStreamModes]),
  state: z.string(),
  numConnections: z.number().nonnegative(),
  connections: z.array(StreamConnectionDetailsSchema),
});

export type ChannelSessionsResponse = z.infer<
  typeof ChannelSessionsResponseSchema
>;

// This is sorta hacky.
export const GetChannelProgrammingResponseSchema =
  CondensedChannelProgrammingSchema;

export const JellyfinGetLibraryItemsQuerySchema = z.object({
  offset: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().positive().optional(),
  itemTypes: z
    .string()
    .optional()
    .transform((s) => s?.split(','))
    .pipe(JellyfinItemKind.array().optional()),
  extraFields: z
    .string()
    .optional()
    .transform((s) => s?.split(','))
    .pipe(JellyfinItemFields.array().optional()),
  // pipe delimited
  genres: z
    .string()
    .optional()
    .transform((s) => s?.split('|').filter((s) => s.trim().length > 0)),
  nameStartsWithOrGreater: z.string().min(1).optional(),
  nameStartsWith: z.string().min(1).optional(),
  nameLessThan: z.string().min(1).optional(),
});

export const MediaSourceHealthyStatusSchema = z.object({
  healthy: z.literal(true),
});

export const MediaSourceUnhealthyStatusSchema = z.object({
  healthy: z.literal(false),
  status: z.enum(['unreachable', 'auth', 'timeout', 'bad_response', 'unknown']),
});

export type MediaSourceUnhealthyStatus = z.infer<
  typeof MediaSourceUnhealthyStatusSchema
>;

export const MediaSourceStatusSchema = MediaSourceHealthyStatusSchema.or(
  MediaSourceUnhealthyStatusSchema,
);

export type MediaSourceStatus = z.infer<typeof MediaSourceStatusSchema>;

export const TimeSlotScheduleResult = z.object({
  startTime: z.number().positive(),
  lineup: CondensedChannelProgramSchema.array(),
  programs: z.record(z.string(), ContentProgramSchema),
  seed: z.number().array(),
});

export type TimeSlotScheduleResult = z.infer<typeof TimeSlotScheduleResult>;

export const SlotScheduleResult = z.object({
  startTime: z.number().positive(),
  lineup: CondensedChannelProgramSchema.array(),
  programs: z.record(z.string(), ContentProgramSchema),
  seed: z.number().array(),
});

export type SlotScheduleResult = z.infer<typeof SlotScheduleResult>;

export const ProgramChildrenResult = PagedResult(
  z
    .object({
      type: z.enum(['season', 'album']),
      programs: z
        .array(TvSeasonContentProgramSchema)
        .or(z.array(MusicAlbumContentProgramSchema)),
    })
    .or(
      z.object({
        type: z.enum(['episode', 'track']),
        programs: z.array(ContentProgramSchema),
      }),
    ),
);
