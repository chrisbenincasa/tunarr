import { DataTag, useQueries, useQuery } from '@tanstack/react-query';
import { Channel, CondensedChannelProgramming } from '@tunarr/types';
import { channelQuery } from './useChannels.ts';
import { ApiClient } from '../external/api.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const channelProgrammingQuery = (
  apiClient: ApiClient,
  id: string,
  enabled: boolean,
) => {
  return {
    queryKey: ['channels', id, 'programming'] as DataTag<
      ['channels', string, 'programming'],
      CondensedChannelProgramming
    >,
    queryFn: async () =>
      apiClient.get('/api/channels/:id/programming', {
        params: { id },
      }),
    enabled: id.length > 0 && enabled,
  };
};

export const useChannelProgramming = (id: string, enabled: boolean = true) => {
  const apiClient = useTunarrApi();
  return useQuery(channelProgrammingQuery(apiClient, id, enabled));
};

export const useChannelAndProgramming = (
  id: string,
  enabled: boolean = true,
  initialData?: { channel?: Channel; lineup?: CondensedChannelProgramming },
) => {
  const apiClient = useTunarrApi();
  return useQueries({
    queries: [
      {
        ...channelQuery(apiClient, id, enabled),
        initialData: initialData?.channel,
      },
      {
        ...channelProgrammingQuery(apiClient, id, enabled),
        initialData: initialData?.lineup,
      },
    ],
    combine: ([channelResult, lineupResult]) => {
      return {
        error: channelResult.error || lineupResult.error,
        isPending: channelResult.isPending || lineupResult.isPending,
        data: {
          channel: channelResult.data,
          lineup: lineupResult.data,
        },
      };
    },
  });
};
