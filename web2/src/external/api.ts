import { Zodios, makeApi, makeErrors, parametersBuilder } from '@zodios/core';
import {
  BatchLookupExternalProgrammingSchema,
  CreateCustomShowRequestSchema,
} from '@tunarr/types/api';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  ChannelSchema,
  CustomShowProgrammingSchema,
  CustomShowSchema,
  ProgramSchema,
  TaskSchema,
  UpdateChannelRequestSchema,
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
    parameters: parametersBuilder().addBody(UpdateChannelRequestSchema).build(),
    path: '/api/v2/channels',
    response: z.object({ id: z.string() }),
  },
  {
    method: 'get',
    path: '/api/v2/channels/:number',
    parameters: parametersBuilder()
      .addParameter('number', 'Path', z.coerce.number())
      .build(),
    response: ChannelSchema,
  },
  {
    method: 'get',
    path: '/api/v2/channels/:number/programming',
    parameters: parametersBuilder()
      .addParameter('number', 'Path', z.coerce.number())
      .build(),
    response: ChannelProgrammingSchema,
  },
  {
    method: 'post',
    path: '/api/v2/channels/:number/programming',
    requestFormat: 'json',
    parameters: parametersBuilder()
      .addParameter('number', 'Path', z.coerce.number())
      .addBody(z.array(ChannelProgramSchema))
      .build(),
    response: ChannelProgrammingSchema,
  },
  {
    method: 'get',
    path: '/api/v2/channels/:number/lineup',
    response: ChannelLineupSchema,
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
]);

export const createApiClient = once((uri: string) => {
  // return createBaseApiClient(uri);
  return new Zodios(uri, api);
});

export const apiClient = createApiClient('http://localhost:8000');
