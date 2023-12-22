import { once } from 'lodash-es';
import { createApiClient as createBaseApiClient } from '../generated/client.ts';

export const createApiClient = once((uri: string) => {
  return createBaseApiClient(uri);
});

export const apiClient = createApiClient('http://localhost:8000');
