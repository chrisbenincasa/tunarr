import type { DataTag } from '@tanstack/react-query';
import {
  queryOptions,
  useQuery,
  useSuspenseQueries,
} from '@tanstack/react-query';
import type { Channel, CondensedChannelProgramming } from '@tunarr/types';
import type { ApiClient } from '../external/api.ts';
import { channelQuery } from './useChannels.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const channelProgrammingQuery = (
  apiClient: ApiClient,
  id: string,
  enabled: boolean = true,
  pageParams: { offset: number; limit: number } | undefined = undefined,
) =>
  queryOptions({
    queryKey: ['channels', id, 'programming'] as DataTag<
      ['channels', string, 'programming'],
      CondensedChannelProgramming
    >,
    queryFn: async () =>
      apiClient.get('/api/channels/:id/programming', {
        params: { id },
        queries: pageParams,
      }),
    enabled: id.length > 0 && enabled,
    staleTime: 10_000,
  });

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
  return useSuspenseQueries({
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
