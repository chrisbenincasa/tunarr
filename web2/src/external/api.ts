import { Zodios, makeApi, parametersBuilder } from '@zodios/core';
import {
  BatchLookupExternalProgrammingSchema,
  CreateCustomShowRequestSchema,
} from 'dizquetv-types/api';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  ChannelSchema,
  CustomShowProgrammingSchema,
  CustomShowSchema,
  ProgramSchema,
  UpdateChannelRequestSchema,
} from 'dizquetv-types/schemas';
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
    method: 'post',
    path: '/api/v2/programming/batch/lookup',
    alias: 'batchGetProgramsByExternalIds',
    parameters: parametersBuilder()
      .addBody(BatchLookupExternalProgrammingSchema)
      .build(),
    response: z.array(ProgramSchema),
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
]);

export const createApiClient = once((uri: string) => {
  // return createBaseApiClient(uri);
  return new Zodios(uri, api);
});

export const apiClient = createApiClient('http://localhost:8000');
