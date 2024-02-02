import { Zodios, makeApi, makeErrors, parametersBuilder } from '@zodios/core';
import {
  BatchLookupExternalProgrammingSchema,
  CreateCustomShowRequestSchema,
  CreateFillerListRequestSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  ChannelSchema,
  CustomShowProgrammingSchema,
  CustomShowSchema,
  FillerListProgrammingSchema,
  FillerListSchema,
  ProgramSchema,
  TaskSchema,
  SaveChannelRequestSchema,
} from '@tunarr/types/schemas';
import { once } from 'lodash-es';
import { z } from 'zod';

export const api = makeApi([
  {
    method: 'get',
    path: '/api/v2/channels',
    response: z.array(ChannelSchema),
  },
  {
    method: 'post',
    parameters: parametersBuilder().addBody(SaveChannelRequestSchema).build(),
    path: '/api/v2/channels',
    alias: 'createChannel',
    status: 201,
    response: z.object({ id: z.string() }),
  },
  {
    method: 'put',
    parameters: parametersBuilder()
      .addBody(SaveChannelRequestSchema)
      .addPath('id', z.string())
      .build(),
    path: '/api/v2/channels/:id',
    response: ChannelSchema.omit({ programs: true }),
    alias: 'updateChannel',
  },
  {
    method: 'get',
    path: '/api/v2/channels/:id',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    response: ChannelSchema,
  },
  {
    method: 'get',
    path: '/api/v2/channels/:id/programming',
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    response: ChannelProgrammingSchema,
  },
  {
    method: 'post',
    path: '/api/v2/channels/:id/programming',
    requestFormat: 'json',
    parameters: parametersBuilder()
      .addPath('id', z.string())
      .addBody(z.array(ChannelProgramSchema))
      .build(),
    response: ChannelProgrammingSchema,
  },
  {
    method: 'get',
    path: '/api/v2/channels/:id/lineup',
    response: ChannelLineupSchema,
    parameters: parametersBuilder().addPath('id', z.string()).build(),
    alias: 'getChannelLineup',
  },
  {
    method: 'get',
    path: '/api/v2/channels/all/lineups',
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
    method: 'post',
    path: '/api/v2/programming/batch/lookup',
    alias: 'batchGetProgramsByExternalIds',
    parameters: parametersBuilder()
      .addBody(BatchLookupExternalProgrammingSchema)
      .build(),
    response: z.array(ProgramSchema.partial().required({ id: true })),
  },
  {
    method: 'get',
    path: '/api/v2/custom-shows',
    alias: 'getCustomShows',
    response: z.array(CustomShowSchema),
  },
  {
    method: 'get',
    path: '/api/v2/custom-shows/:id',
    alias: 'getCustomShow',
    response: CustomShowSchema,
    parameters: parametersBuilder()
      .addPaths({
        id: z.string(),
      })
      .build(),
  },
  {
    method: 'post',
    path: '/api/v2/custom-shows',
    alias: 'createCustomShow',
    status: 201,
    response: z.object({ id: z.string() }),
    parameters: parametersBuilder()
      .addBody(CreateCustomShowRequestSchema)
      .build(),
  },
  {
    method: 'get',
    path: '/api/v2/custom-shows/:id/programs',
    alias: 'getCustomShowPrograms',
    response: CustomShowProgrammingSchema,
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
        name: z.string(),
        path: z.string(),
      })
      .build(),
    response: z.any(),
  },
  {
    method: 'get',
    path: '/api/v2/jobs',
    alias: 'getTasks',
    response: z.array(TaskSchema),
  },
  {
    method: 'post',
    path: '/api/v2/jobs/:id/run',
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
    path: '/api/v2/fillers/:id',
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
    path: '/api/v2/fillers/:id/programs',
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
    path: '/api/v2/fillers',
    alias: 'getFillerLists',
    response: z.array(FillerListSchema),
  },
  {
    method: 'post',
    path: '/api/v2/fillers',
    alias: 'createFillerList',
    parameters: parametersBuilder()
      .addBody(CreateFillerListRequestSchema)
      .build(),
    status: 201,
    response: z.object({ id: z.string() }),
  },
]);

export const createApiClient = once((uri: string) => {
  return new Zodios(uri, api);
});

export const apiClient = createApiClient('http://localhost:8000');
