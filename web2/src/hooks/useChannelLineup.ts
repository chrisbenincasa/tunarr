import { DataTag, useQueries, useQuery } from '@tanstack/react-query';
import { Channel, CondensedChannelProgramming } from '@tunarr/types';
import { apiClient } from '../external/api.ts';
import { channelQuery } from './useChannels.ts';

export const channelProgrammingQuery = (id: string, enabled: boolean) => {
  return {
    queryKey: ['channels', id, 'programming'] as DataTag<
      ['channels', string, 'programming'],
      CondensedChannelProgramming
    >,
    queryFn: async () =>
      apiClient.get('/api/v2/channels/:id/programming', {
        params: { id },
      }),
    enabled: id.length > 0 && enabled,
  };
};

export const useChannelProgramming = (id: string, enabled: boolean = true) => {
  return useQuery(channelProgrammingQuery(id, enabled));
};

export const useChannelAndProgramming = (
  id: string,
  enabled: boolean = true,
  initialData?: { channel?: Channel; lineup?: CondensedChannelProgramming },
) =>
  useQueries({
    queries: [
      { ...channelQuery(id, enabled), initialData: initialData?.channel },
      {
        ...channelProgrammingQuery(id, enabled),
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
