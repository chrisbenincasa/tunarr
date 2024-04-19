import { DataTag, useQuery } from '@tanstack/react-query';
import { Channel } from '@tunarr/types';
import { ApiClient } from '../external/api';
import { useTunarrApi } from './useTunarrApi';

export const channelsQuery = (
  apiClient: ApiClient,
  initialData: Channel[] = [],
) => ({
  queryKey: ['channels'] as DataTag<['channels'], Channel[]>,
  queryFn: () => apiClient.get('/api/channels'),
  initialData,
});

export const useChannels = (initialData: Channel[] = []) => {
  const apiClient = useTunarrApi();
  return useQuery(channelsQuery(apiClient, initialData));
};

export const channelQuery = (
  apiClient: ApiClient,
  id: string,
  enabled: boolean = true,
) => ({
  queryKey: ['channels', id] as DataTag<['channels', string], Channel>,
  queryFn: async () =>
    apiClient.get('/api/channels/:id', {
      params: { id },
    }),
  enabled: id.length > 0 && enabled,
});

export const useChannel = (
  id: string,
  enabled: boolean = true,
  initialData: Channel | undefined = undefined,
) => {
  const apiClient = useTunarrApi();
  return useQuery({ ...channelQuery(apiClient, id, enabled), initialData });
};

// If we absolutely have initialData defined, we can use this hook instead,
// to eliminate the typing possiblity of "| undefined" for the resulting Channel
export const useChannelWithInitialData = (
  id: string,
  initialData: Channel,
  enabled: boolean = true,
) => {
  const apiClient = useTunarrApi();
  return useQuery({ ...channelQuery(apiClient, id, enabled), initialData });
};
