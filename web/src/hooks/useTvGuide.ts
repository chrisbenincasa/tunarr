import {
  UseQueryOptions,
  UseQueryResult,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { ChannelLineup } from '@tunarr/types';
import { Dayjs } from 'dayjs';
import { identity, isUndefined } from 'lodash-es';
import { ApiClient } from '../external/api.ts';
import { useTunarrApi } from './useTunarrApi.ts';

const dateRangeQueryKey = (range: { from: Dayjs; to: Dayjs }) =>
  `${range.from.unix()}_${range.to.unix()}`;

function lineupQueryOpts<Out = ChannelLineup | undefined>(
  apiClient: ApiClient,
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

const allLineupsQueryOpts = (
  apiClient: ApiClient,
  range: {
    from: Dayjs;
    to: Dayjs;
  },
): UseQueryOptions<ChannelLineup[]> => ({
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
}) => {
  const client = useTunarrApi();
  return useQuery(
    lineupQueryOpts(client, params.channelId, {
      from: params.from,
      to: params.to,
    }),
  );
};

export const useTvGuides = (
  channelId: string,
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
): UseQueryResult<ChannelLineup[], Error> => {
  const client = useTunarrApi();
  const singleChannelResult = useQuery({
    ...lineupQueryOpts(client, channelId, params, (lineup) =>
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
  const client = useTunarrApi();
  const queryClient = useQueryClient();
  const query: UseQueryOptions<ChannelLineup[]> =
    channelId !== 'all'
      ? {
          ...lineupQueryOpts(client, channelId, params, (lineup) =>
            !isUndefined(lineup) ? [lineup] : [],
          ),
          ...extraOpts,
        }
      : {
          ...allLineupsQueryOpts(client, params),
          ...extraOpts,
        };

  queryClient.prefetchQuery(query).catch(console.error);
};

export const useAllTvGuides = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<UseQueryOptions<ChannelLineup[]>> = {},
) => {
  const client = useTunarrApi();
  return useQuery({ ...allLineupsQueryOpts(client, params), ...extraOpts });
};

export const useAllTvGuidesDebug = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<
    UseQueryOptions<{ old: ChannelLineup; new: ChannelLineup }[]>
  > = {},
) => {
  const apiClient = useTunarrApi();
  return useQuery({
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
};
