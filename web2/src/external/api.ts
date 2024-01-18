import { Zodios, makeApi, parametersBuilder } from '@zodios/core';
import { BatchLookupExternalProgrammingSchema } from 'dizquetv-types/api';
import {
  ChannelLineupSchema,
  ChannelProgramSchema,
  ChannelProgrammingSchema,
  ChannelSchema,
  ProgramSchema,
  UpdateChannelRequestSchema,
} from 'dizquetv-types/schemas';
import { once } from 'lodash-es';
import { z } from 'zod';

const api = makeApi([
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
]);

export const createApiClient = once((uri: string) => {
  // return createBaseApiClient(uri);
  return new Zodios(uri, api);
});

export const apiClient = createApiClient('http://localhost:8000');
