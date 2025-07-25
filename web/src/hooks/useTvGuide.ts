import type {
  DefaultError,
  UseQueryOptions,
  UseQueryResult,
  UseSuspenseQueryOptions,
} from '@tanstack/react-query';
import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ChannelLineup, TvGuideProgram } from '@tunarr/types';
import type { Dayjs } from 'dayjs';
import { identity, isUndefined } from 'lodash-es';
import { useEffect } from 'react';
import type { StrictOmit } from 'ts-essentials';
import type { ApiClient } from '../external/api.ts';
import { useTunarrApi } from './useTunarrApi.ts';

const dateRangeQueryKey = (range: { from: Dayjs; to: Dayjs }) =>
  `${+range.from}_${+range.to}`;

type ChannelLineupQueryKey = ['channels', string, 'guide', string];
type ChannelLineupQueryOpts<Out = ChannelLineup> = UseQueryOptions<
  ChannelLineup,
  DefaultError,
  Out,
  ChannelLineupQueryKey
>;
type AllLineupsQueryOpts = UseQueryOptions<
  ChannelLineup[],
  DefaultError,
  ChannelLineup[],
  ChannelLineupQueryKey
>;

function lineupQueryOpts<Out = ChannelLineup>(
  apiClient: ApiClient,
  channelId: string,
  range: { from: Dayjs; to: Dayjs },
  mapper: (lineup: ChannelLineup) => Out = identity,
): ChannelLineupQueryOpts<Out> {
  return queryOptions({
    queryKey: [
      'channels',
      channelId,
      'guide',
      dateRangeQueryKey(range),
    ] satisfies ChannelLineupQueryKey,
    queryFn: () => {
      return apiClient.getChannelLineup({
        params: { id: channelId },
        queries: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
    },
    select: mapper,
  });
}

const allLineupsQueryOpts = (
  apiClient: ApiClient,
  range: {
    from: Dayjs;
    to: Dayjs;
  },
): AllLineupsQueryOpts =>
  queryOptions({
    queryKey: [
      'channels',
      'all',
      'guide',
      dateRangeQueryKey(range),
    ] satisfies ChannelLineupQueryKey,
    queryFn: () => {
      return apiClient.getAllChannelLineups({
        queries: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
    },
  });

type UseTvGuideOpts = {
  channelId: string;
  from: Dayjs;
  to: Dayjs;
};

export const useTvGuide = (params: UseTvGuideOpts) => {
  const client = useTunarrApi();
  return useQuery(
    lineupQueryOpts(client, params.channelId, {
      from: params.from,
      to: params.to,
    }),
  );
};

export const useChannelNowPlaying = (
  channelId: string,
  opts: Partial<
    StrictOmit<
      UseSuspenseQueryOptions<TvGuideProgram, DefaultError>,
      'queryKey' | 'queryFn'
    >
  > = {},
) => {
  const client = useTunarrApi();

  // const fullOpts: UseSuspenseQueryOptions<
  //   ChannelLineup,
  //   DefaultError,
  //   Out,
  //   ChannelLineupQueryKey
  // > = useMemo(
  //   () => ({
  //     ...lineupQueryOpts(client, params.channelId, {
  //       from: params.from,
  //       to: params.to,
  //     }),
  //     ...opts,
  //   }),
  //   [client, opts, params.channelId, params.from, params.to],
  // );

  return useSuspenseQuery({
    queryKey: ['channels', channelId, 'now_playing'],
    queryFn: () => client.getChannelNowPlaying({ params: { id: channelId } }),
    ...opts,
  });
};

export const useTvGuides = (
  channelId: string,
  params: { from: Dayjs; to: Dayjs },

  extraOpts: Partial<
    Omit<
      UseQueryOptions<
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        any,
        DefaultError,
        ChannelLineup[],
        ChannelLineupQueryKey
      >,
      'queryKey' | 'queryFn' | 'enabled'
    >
  > = {},
): UseQueryResult<ChannelLineup[]> => {
  const client = useTunarrApi();
  const singleChannelResult = useQuery({
    ...lineupQueryOpts<ChannelLineup[]>(client, channelId, params, (lineup) =>
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
  extraOpts: Partial<Omit<AllLineupsQueryOpts, 'queryKey' | 'queryFn'>> = {},
) => {
  const client = useTunarrApi();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (channelId === 'all') {
      queryClient
        .prefetchQuery({
          ...allLineupsQueryOpts(client, params),
          ...extraOpts,
        })
        .catch(console.error);
    } else {
      queryClient
        .prefetchQuery({
          ...lineupQueryOpts(client, channelId, params, (lineup) =>
            !isUndefined(lineup) ? [lineup] : [],
          ),
        })
        .catch(console.error);
    }
  }, [channelId, client, extraOpts, params, queryClient]);
};

export const useAllTvGuides = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<Omit<AllLineupsQueryOpts, 'queryKey' | 'queryFn'>> = {},
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
