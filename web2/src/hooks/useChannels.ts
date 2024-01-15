import { DataTag, useQuery } from '@tanstack/react-query';
import { Channel } from 'dizquetv-types';
import { apiClient } from '../external/api.ts';

export const channelsQuery = {
  queryKey: ['channels'] as DataTag<['channels'], Channel[]>,
  queryFn: () => apiClient.get('/api/v2/channels'),
};

export const useChannels = () => useQuery(channelsQuery);

export const channelQuery = (number: number, enabled: boolean = true) => ({
  queryKey: ['channels', number] as DataTag<['channels', number], Channel>,
  queryFn: async () =>
    apiClient.get('/api/v2/channels/:number', {
      params: { number },
    }),
  enabled: number > 0 && enabled,
});

export const useChannel = (
  number: number,
  enabled: boolean = true,
  initialData: Channel | undefined = undefined,
) => useQuery({ ...channelQuery(number, enabled), initialData });

// If we absolutely have initialData defined, we can use this hook instead,
// to eliminate the typing possiblity of "| undefined" for the resulting Channel
export const useChannelWithInitialData = (
  number: number,
  initialData: Channel,
  enabled: boolean = true,
) => useQuery({ ...channelQuery(number, enabled), initialData });
