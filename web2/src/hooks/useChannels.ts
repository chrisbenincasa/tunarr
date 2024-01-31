import { DataTag, useQuery } from '@tanstack/react-query';
import { Channel } from '@tunarr/types';
import { apiClient } from '../external/api.ts';

export const channelsQuery = {
  queryKey: ['channels'] as DataTag<['channels'], Channel[]>,
  queryFn: () => apiClient.get('/api/v2/channels'),
};

export const useChannels = () => useQuery(channelsQuery);

export const channelQuery = (id: string, enabled: boolean = true) => ({
  queryKey: ['channels', id] as DataTag<['channels', string], Channel>,
  queryFn: async () =>
    apiClient.get('/api/v2/channels/:id', {
      params: { id },
    }),
  enabled: id.length > 0 && enabled,
});

export const useChannel = (
  id: string,
  enabled: boolean = true,
  initialData: Channel | undefined = undefined,
) => useQuery({ ...channelQuery(id, enabled), initialData });

// If we absolutely have initialData defined, we can use this hook instead,
// to eliminate the typing possiblity of "| undefined" for the resulting Channel
export const useChannelWithInitialData = (
  id: string,
  initialData: Channel,
  enabled: boolean = true,
) => useQuery({ ...channelQuery(id, enabled), initialData });
