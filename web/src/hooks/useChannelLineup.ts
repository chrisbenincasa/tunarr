import {
  queryOptions,
  useQuery,
  useSuspenseQueries,
} from '@tanstack/react-query';
import type { Channel, CondensedChannelProgramming } from '@tunarr/types';
import { getApiChannelsByIdProgrammingOptions } from '../generated/@tanstack/react-query.gen.ts';
import { channelQuery } from './useChannels.ts';

export const channelProgrammingQuery = (
  id: string,
  enabled: boolean = true,
  pageParams: { offset: number; limit: number } | undefined = undefined,
) =>
  queryOptions({
    ...getApiChannelsByIdProgrammingOptions({
      path: { id },
      query: pageParams,
    }),
    enabled: id.length > 0 && enabled,
    staleTime: 10_000,
  });

export const useChannelProgramming = (id: string, enabled: boolean = true) => {
  return useQuery(channelProgrammingQuery(id, enabled));
};

export const useChannelAndProgramming = (
  id: string,
  enabled: boolean = true,
  initialData?: { channel?: Channel; lineup?: CondensedChannelProgramming },
) => {
  return useSuspenseQueries({
    queries: [
      {
        ...channelQuery(id, enabled),
        initialData: initialData?.channel,
      },
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
};
