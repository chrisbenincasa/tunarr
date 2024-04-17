import {
  QueryClient,
  UseQueryOptions,
  UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ChannelLineup } from '@tunarr/types';
import { Dayjs } from 'dayjs';
import { apiClient } from '../external/api.ts';
import { identity, isUndefined } from 'lodash-es';

const dateRangeQueryKey = (range: { from: Dayjs; to: Dayjs }) =>
  `${range.from.unix()}_${range.to.unix()}`;

function lineupQueryOpts<Out = ChannelLineup | undefined>(
  channelId: string,
  range: { from: Dayjs; to: Dayjs },
  mapper: (lineup: ChannelLineup | undefined) => Out = identity,
) {
  return {
    queryKey: ['channels', channelId, 'guide', dateRangeQueryKey(range)],
    queryFn: async () => {
      return apiClient
        .get('/api/channels/:id/lineup', {
          params: { id: channelId },
          queries: {
            from: range.from.toISOString(),
            to: range.to.toISOString(),
          },
        })
        .then(mapper);
    },
  };
}

const allLineupsQueryOpts = (range: {
  from: Dayjs;
  to: Dayjs;
}): UseQueryOptions<ChannelLineup[]> => ({
  queryKey: ['channels', 'all', 'guide', dateRangeQueryKey(range)],
  queryFn: async () => {
    return apiClient.get('/api/channels/all/lineups', {
      queries: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    });
  },
});

export const useTvGuide = (params: {
  channelId: string;
  from: Dayjs;
  to: Dayjs;
}) =>
  useQuery(
    lineupQueryOpts(params.channelId, { from: params.from, to: params.to }),
  );

export const useTvGuides = (
  channelId: string,
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
): UseQueryResult<ChannelLineup[], Error> => {
  const singleChannelResult = useQuery({
    ...lineupQueryOpts(channelId, params, (lineup) =>
      !isUndefined(lineup) ? [lineup] : [],
    ),
    ...extraOpts,
    enabled: channelId !== 'all',
  });

  const allChannelsResult = useAllTvGuides(params, {
    ...extraOpts,
    enabled: channelId === 'all',
  });

  return channelId === 'all' ? allChannelsResult : singleChannelResult;
};

export const useTvGuidesPrefetch = (
  channelId: string,
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
) => {
  const queryClient = useQueryClient();
  const query: UseQueryOptions<ChannelLineup[]> =
    channelId !== 'all'
      ? {
          ...lineupQueryOpts(channelId, params, (lineup) =>
            !isUndefined(lineup) ? [lineup] : [],
          ),
          ...extraOpts,
        }
      : {
          ...allLineupsQueryOpts(params),
          ...extraOpts,
        };

  queryClient.prefetchQuery(query).catch(console.error);
};

export const useAllTvGuides = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
) => useQuery({ ...allLineupsQueryOpts(params), ...extraOpts });

export const useAllTvGuidesDebug = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<
    UseQueryOptions<{ old: ChannelLineup; new: ChannelLineup }[]>
  > = {},
) =>
  useQuery({
    queryKey: ['channels', 'all', 'guide', dateRangeQueryKey(params)],
    queryFn: async () => {
      return apiClient.getAllChannelLineupsDebug({
        queries: {
          from: params.from.toISOString(),
          to: params.to.toISOString(),
        },
      });
    },
    ...extraOpts,
  });

export const prefetchAllTvGuides =
  (queryClient: QueryClient) =>
  async (
    params: { from: Dayjs; to: Dayjs },
    extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
  ) => {
    return await queryClient.prefetchQuery({
      ...allLineupsQueryOpts(params),
      ...extraOpts,
    });
  };
