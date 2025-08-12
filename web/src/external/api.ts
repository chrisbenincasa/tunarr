import {
  BaseErrorSchema,
  BatchLookupExternalProgrammingSchema,
  ChannelSessionsResponseSchema,
  CreateCustomShowRequestSchema,
  CreateFillerListRequestSchema,
  PagedResult,
  ProgramChildrenResult,
  RandomSlotScheduleSchema,
  SlotScheduleResult,
  TimeSlotScheduleResult,
  TimeSlotScheduleSchema,
  UpdateChannelProgrammingRequestSchema,
  UpdateCustomShowRequestSchema,
  UpdateFillerListRequestSchema,
  VersionApiResponseSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelSchema,
  CondensedChannelProgrammingSchema,
  ContentProgramParentSchema,
  ContentProgramSchema,
  ContentProgramTypeSchema,
  CreateChannelRequestSchema,
  CustomProgramSchema,
  CustomShowSchema,
  ExternalSourceTypeSchema,
  FillerListProgrammingSchema,
  FillerListSchema,
  SaveableChannelSchema,
  TaskSchema,
  TranscodeConfigSchema,
  TvGuideProgramSchema,
} from '@tunarr/types/schemas';
import {
  Zodios,
  type ZodiosInstance,
  type ZodiosOptions,
  makeApi,
  makeErrors,
  parametersBuilder,
} from '@tunarr/zodios-core';
import { isEmpty } from 'lodash-es';
import querystring from 'query-string';
import { z } from 'zod/v4';
import { embyEndpoints } from './embyApi.ts';
import { getFfmpegInfoEndpoint } from './ffmpegApi.ts';
import { jellyfinEndpoints } from './jellyfinApi.ts';
import { endpoints as settingsEndpoints } from './settingsApi.ts';

export const api = makeApi([
  {
    method: 'get',
    path: '/api/version',
    response: VersionApiResponseSchema,
    alias: 'getServerVersions',
  },
  {
    method: 'get',
    path: '/api/channels',
    alias: 'getChannels',
    response: z.array(ChannelSchema),
  },
  {
    method: 'post',
    parameters: parametersBuilder().addBody(CreateChannelRequestSchema).build(),
    path: '/api/channels',
    alias: 'createChannel',
    status: 201,
    response: ChannelSchema,
  },
  {
    method: 'put',
    parameters: parametersBuilder()
      .addBody(SaveableChannelSchema)
      .addPath('id', z.string())
      .build(),
    path: '/api/channels/:id',
    response: ChannelSchema,
    alias: 'updateChannel',
  },
  {
    method: 'delete',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    path: '/api/channels/:id',
    response: z.void(),
    alias: 'deleteChannel',
  },
  {
    method: 'get',
    path: '/api/channels/:id',
    alias: 'getChannel',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    response: ChannelSchema,
    errors: makeErrors([
      {
        status: 404,
        schema: BaseErrorSchema,
      },
      {
        status: 500,
        schema: BaseErrorSchema,
      },
    ]),
  },
  {
    method: 'get',
    path: '/api/channels/:id/programming',
    alias: 'getChannelProgramming',
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addQueries({
        offset: z.number().optional(),
        limit: z.number().optional(),
      })
      .build(),
    response: CondensedChannelProgrammingSchema,
  },
  {
    method: 'get',
    path: '/api/channels/:id/transcode_config',
    alias: 'getChannelTranscodeConfig',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    response: TranscodeConfigSchema,
  },
  {
    method: 'post',
    path: '/api/channels/:id/programming',
    requestFormat: 'json',
    alias: 'updateChannelProgramming',
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addBody(UpdateChannelProgrammingRequestSchema)
      .build(),
    response: CondensedChannelProgrammingSchema,
  },
  {
    method: 'get',
    path: '/api/channels/:id/lineup',
    response: ChannelLineupSchema,
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addQueries({
        from: z.iso.date(),
        to: z.iso.date(),
      })
      .build(),
    alias: 'getChannelLineup',
  },
  {
    method: 'get',
    path: '/api/channels/:id/now_playing',
    response: TvGuideProgramSchema,
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    alias: 'getChannelNowPlaying',
  },
  {
    method: 'get',
    path: '/api/channels/:id/shows',
    response: PagedResult(z.array(ContentProgramParentSchema)),
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addQueries({
        offset: z.number().nonnegative().default(0),
        limit: z.number().min(-1).default(-1),
      })
      .build(),
    alias: 'getChannelShows',
  },
  {
    method: 'get',
    path: '/api/channels/:id/artists',
    response: PagedResult(z.array(ContentProgramParentSchema)),
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addQueries({
        offset: z.number().nonnegative().default(0),
        limit: z.number().min(-1).default(-1),
      })
      .build(),
    alias: 'getChannelArtists',
  },
  {
    method: 'get',
    path: '/api/channels/:id/programs',
    response: z.array(ContentProgramSchema),
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addQueries({
        offset: z.number().nonnegative().default(0),
        limit: z.number().min(-1).default(-1),
        type: ContentProgramTypeSchema.optional(),
      })
      .build(),
    alias: 'getChannelPrograms',
  },
  {
    method: 'get',
    path: '/api/channels/:id/sessions',
    response: z.array(ChannelSessionsResponseSchema),
    parameters: parametersBuilder()
      .addPath('id', z.string().or(z.coerce.number()))
      .build(),
    alias: 'getChannelSessions',
  },
  {
    method: 'delete',
    path: '/api/channels/:id/sessions',
    response: z.void(),
    parameters: parametersBuilder()
      .addPath('id', z.string().or(z.coerce.number()))
      .build(),
    alias: 'stopChannelSessions',
  },
  {
    method: 'get',
    path: '/api/sessions',
    response: z.record(z.string(), z.array(ChannelSessionsResponseSchema)),
    alias: 'getAllChannelSessions',
  },
  {
    method: 'get',
    path: '/api/channels/all/lineups',
    response: z.array(ChannelLineupSchema),
    parameters: parametersBuilder()
      .addQueries({
        from: z.string(),
        to: z.string(),
      })
      .build(),
    alias: 'getAllChannelLineups',
  },
  {
    method: 'get',
    path: '/api/debug/helpers/compare_guides',
    response: z.array(
      z.object({ old: ChannelLineupSchema, new: ChannelLineupSchema }),
    ),
    parameters: parametersBuilder()
      .addQueries({
        from: z.string(),
        to: z.string(),
      })
      .build(),
    alias: 'getAllChannelLineupsDebug',
  },
  {
    method: 'post',
    path: '/api/programming/batch/lookup',
    alias: 'batchGetProgramsByExternalIds',
    parameters: parametersBuilder()
      .addBody(BatchLookupExternalProgrammingSchema)
      .build(),
    response: z.record(z.string(), ContentProgramSchema),
  },
  {
    method: 'get',
    path: '/api/custom-shows',
    alias: 'getCustomShows',
    response: z.array(CustomShowSchema),
  },
  {
    method: 'get',
    path: '/api/custom-shows/:id',
    alias: 'getCustomShow',
    response: CustomShowSchema,
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .build(),
  },
  {
    method: 'put',
    path: '/api/custom-shows/:id',
    alias: 'updateCustomShow',
    response: CustomShowSchema,
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .addBody(UpdateCustomShowRequestSchema)
      .build(),
  },
  {
    method: 'delete',
    path: '/api/custom-shows/:id',
    alias: 'deleteCustomShow',
    response: z.object({ id: z.string() }),
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .build(),
  },
  {
    method: 'post',
    path: '/api/custom-shows',
    alias: 'createCustomShow',
    status: 201,
    response: z.object({ id: z.string() }),
    parameters: parametersBuilder()
      .addBody(CreateCustomShowRequestSchema)
      .build(),
  },
  {
    method: 'get',
    path: '/api/custom-shows/:id/programs',
    alias: 'getCustomShowPrograms',
    response: z.array(CustomProgramSchema),
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .build(),
  },
  {
    method: 'get',
    path: '/api/plex',
    alias: 'getPlexPath',
    parameters: parametersBuilder()
      .addQueries({
        id: z.string(),
        path: z.string(),
      })
      .build(),
    response: z.any(),
  },
  {
    method: 'get',
    path: '/api/media-sources/:id/status',
    alias: 'getMediaSourceStatus',
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .build(),
    response: z.object({
      healthy: z.boolean(),
    }),
    errors: makeErrors([
      {
        status: 404,
        schema: BaseErrorSchema,
      },
      {
        status: 500,
        schema: BaseErrorSchema,
      },
    ]),
  },
  {
    method: 'post',
    path: '/api/media-sources/foreignstatus',
    alias: 'getUnknownMediaSourceStatus',
    parameters: parametersBuilder()
      .addBody(
        z.object({
          name: z.string().optional(),
          accessToken: z.string(),
          uri: z.string(),
          username: z.string().optional(),
          type: ExternalSourceTypeSchema,
        }),
      )
      .build(),
    response: z.object({
      healthy: z.boolean(),
    }),
    errors: makeErrors([
      {
        status: 404,
        schema: BaseErrorSchema,
      },
      {
        status: 500,
        schema: BaseErrorSchema,
      },
    ]),
  },
  {
    method: 'get',
    path: '/api/jobs',
    alias: 'getTasks',
    response: z.array(TaskSchema),
  },
  {
    method: 'post',
    path: '/api/jobs/:id/run',
    alias: 'runTask',
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .build(),
    response: z.void(),
    status: 202,
    errors: makeErrors([
      {
        status: 404,
        schema: z.void(),
      },
      { status: 400, schema: z.object({ reason: z.string() }) },
    ]),
  },
  {
    method: 'delete',
    path: '/api/channels.m3u',
    alias: 'clearM3uCache',
    status: 204,
    response: z.void(),
  },
  {
    method: 'get',
    path: '/api/filler-lists/:id',
    alias: 'getFillerList',
    response: FillerListSchema,
    errors: makeErrors([
      {
        status: 404,
        schema: z.void(),
      },
    ]),
    parameters: parametersBuilder().addPath('id', z.string()).build(),
  },
  {
    method: 'get',
    path: '/api/filler-lists/:id/programs',
    alias: 'getFillerListPrograms',
    response: FillerListProgrammingSchema,
    errors: makeErrors([
      {
        status: 404,
        schema: z.void(),
      },
    ]),
    parameters: parametersBuilder().addPath('id', z.string()).build(),
  },
  {
    method: 'get',
    path: '/api/filler-lists',
    alias: 'getFillerLists',
    response: z.array(FillerListSchema),
  },
  {
    method: 'post',
    path: '/api/filler-lists',
    alias: 'createFillerList',
    parameters: parametersBuilder()
      .addBody(CreateFillerListRequestSchema)
      .build(),
    status: 201,
    response: z.object({ id: z.string() }),
  },
  {
    method: 'delete',
    path: '/api/filler-lists/:id',
    alias: 'deleteFillerList',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    response: z.void(),
  },
  {
    method: 'put',
    path: '/api/filler-lists/:id',
    alias: 'updateFillerList',
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addBody(UpdateFillerListRequestSchema)
      .build(),
    response: FillerListSchema,
  },
  {
    method: 'get',
    path: '/stream/channels/:channel.m3u8',
    alias: 'getHlsPlaylist',
    parameters: parametersBuilder()
      .addPath('channel', z.coerce.number().or(z.string().uuid()))
      .build(),
    status: 200,
    response: z.any(),
  },
  getFfmpegInfoEndpoint,
  {
    method: 'post',
    path: '/api/upload/image',
    alias: 'uploadImage',
    requestFormat: 'form-data',
    parameters: parametersBuilder()
      .addBody(z.object({ file: z.instanceof(File) }))
      .build(),
    response: z.object({
      status: z.literal(true),
      message: z.string(),
      data: z.object({
        name: z.string(),
        fileUrl: z.string(),
      }),
    }),
  },
  {
    method: 'post',
    path: '/api/channels/:channelId/schedule-time-slots',
    alias: 'scheduleTimeSlots',
    parameters: parametersBuilder()
      .addPath('channelId', z.string())
      .addBody(
        z.object({
          schedule: TimeSlotScheduleSchema,
        }),
      )
      .build(),
    response: TimeSlotScheduleResult,
  },
  {
    method: 'post',
    path: '/api/channels/:channelId/schedule-slots',
    alias: 'scheduleSlots',
    parameters: parametersBuilder()
      .addPath('channelId', z.string())
      .addBody(
        z.object({
          schedule: RandomSlotScheduleSchema,
        }),
      )
      .build(),
    response: SlotScheduleResult,
  },
  {
    method: 'get',
    path: '/api/programs/:id/children',
    alias: 'getProgramChildren',
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addQueries({
        offset: z.number().nonnegative().default(0),
        limit: z.number().min(-1).default(-1),
        channelId: z.string().optional(),
      })
      .build(),
    response: ProgramChildrenResult,
  },
  {
    method: 'get',
    path: '/api/programs/:id/stream_details',
    alias: 'getProgramStreamDetails',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    response: z.unknown(), // TODO: fill this in
  },
  ...settingsEndpoints,
  ...jellyfinEndpoints,
  ...embyEndpoints,
]);

export type ApiClient = ZodiosInstance<typeof api>;

const opts: ZodiosOptions = {
  validate: 'none',
  axiosConfig: {
    paramsSerializer: (params) =>
      querystring.stringify(params, {
        arrayFormatSeparator: ',',
      }),
  },
};

export const createApiClient = (uri: string) => {
  return isEmpty(uri) ? new Zodios(api, opts) : new Zodios(uri, api, opts);
};
