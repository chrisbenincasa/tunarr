import {
  BaseErrorSchema,
  BatchLookupExternalProgrammingSchema,
  ChannelSessionsResponseSchema,
  CreateCustomShowRequestSchema,
  CreateFillerListRequestSchema,
  UpdateChannelProgrammingRequestSchema,
  UpdateCustomShowRequestSchema,
  UpdateFillerListRequestSchema,
  VersionApiResponseSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelSchema,
  CondensedChannelProgrammingSchema,
  ContentProgramSchema,
  CustomProgramSchema,
  CustomShowSchema,
  FillerListProgrammingSchema,
  FillerListSchema,
  SaveChannelRequestSchema,
  TaskSchema,
} from '@tunarr/types/schemas';
import {
  Zodios,
  ZodiosInstance,
  makeApi,
  makeErrors,
  parametersBuilder,
} from '@zodios/core';
import { isEmpty } from 'lodash-es';
import { z } from 'zod';
import { getFfmpegInfoEndpoint } from './ffmpegApi.ts';
import { endpoints as settingsEndpoints } from './settingsApi.ts';
import { jellyfinEndpoints } from './jellyfinApi.ts';

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
    response: z.array(ChannelSchema),
  },
  {
    method: 'post',
    parameters: parametersBuilder().addBody(SaveChannelRequestSchema).build(),
    path: '/api/channels',
    alias: 'createChannel',
    status: 201,
    response: ChannelSchema,
  },
  {
    method: 'put',
    parameters: parametersBuilder()
      .addBody(SaveChannelRequestSchema)
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
    method: 'post',
    path: '/api/channels/:id/programming',
    requestFormat: 'json',
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
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    alias: 'getChannelLineup',
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
    response: z.record(z.array(ChannelSessionsResponseSchema)),
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
    response: z.record(ContentProgramSchema),
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
          type: z.union([z.literal('plex'), z.literal('jellyfin')]),
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
    method: 'put',
    path: '/media-player/:channel/hls',
    alias: 'startHlsStream',
    parameters: parametersBuilder()
      .addPath('channel', z.coerce.number().or(z.string().uuid()))
      .addBody(z.undefined())
      .build(),
    status: 200,
    response: z.object({ streamPath: z.string() }),
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
  ...settingsEndpoints,
  ...jellyfinEndpoints,
]);

export type ApiClient = ZodiosInstance<typeof api>;

export const createApiClient = (uri: string) => {
  return isEmpty(uri) ? new Zodios(api) : new Zodios(uri, api);
};
