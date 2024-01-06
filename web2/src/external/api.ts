import { once } from 'lodash-es';
import { createApiClient as createBaseApiClient } from '../generated/client.ts';

// const api = makeApi([
//   {
//     method: 'get',
//     path: '/api/v2/channels/:number/lineup',
//     response: ChannelLineupSchema,
//     alias: 'getChannelLineup',
//   },
//   {
//     method: 'post',
//     path: '/api/v2/programming/batch/lookup',
//     alias: 'batchGetProgramsByExternalIds',
//     body:
//   }
// ]);

export const createApiClient = once((uri: string) => {
  return createBaseApiClient(uri);
  // return new Zodios(uri, api);
});

export const apiClient = createApiClient('http://localhost:8000');
