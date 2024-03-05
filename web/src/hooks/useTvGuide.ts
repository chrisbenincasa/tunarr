import { QueryClient, UseQueryOptions, useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { apiClient } from '../external/api.ts';
import { ChannelLineup } from '@tunarr/types';

const dateRangeQueryKey = (range: { from: Dayjs; to: Dayjs }) =>
  `${range.from.unix()}_${range.to.unix()}`;

const lineupQueryOpts = (
  channelId: string,
  range: { from: Dayjs; to: Dayjs },
) => ({
  queryKey: ['channels', channelId, 'guide', dateRangeQueryKey(range)],
  queryFn: async () => {
    return apiClient.get('/api/v2/channels/:id/lineup', {
      params: { id: channelId },
      queries: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    });
  },
});

const allLineupsQueryOpts = (range: {
  from: Dayjs;
  to: Dayjs;
}): UseQueryOptions<ChannelLineup[]> => ({
  queryKey: ['channels', 'all', 'guide', dateRangeQueryKey(range)],
  queryFn: async () => {
    return apiClient.get('/api/v2/channels/all/lineups', {
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

export const useAllTvGuides = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
) => useQuery({ ...allLineupsQueryOpts(params), ...extraOpts });

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
