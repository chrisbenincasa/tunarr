import type { CreateClientConfig } from './generated/client.gen.ts';
import type { Client } from './generated/client/types.gen.ts';
import useStore from './store/index.ts';

export const createClientConfig: CreateClientConfig = (config) => ({
  ...config,
  baseURL: useStore.getState().settings.backendUri,
});

export type TunarrApiClient = Client;
