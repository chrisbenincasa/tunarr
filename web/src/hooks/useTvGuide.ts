import type { UseQueryResult } from '@tanstack/react-query';
import {
  queryOptions,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { ChannelLineup } from '@tunarr/types';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect } from 'react';
import type { StrictOmit } from 'ts-essentials';
import {
  getApiChannelsAllLineupsOptions,
  getApiChannelsByIdLineupOptions,
  getApiChannelsByIdNowPlayingOptions,
} from '../generated/@tanstack/react-query.gen.ts';

function lineupQueryOpts(channelId: string, range: { from: Dayjs; to: Dayjs }) {
  return queryOptions({
    ...getApiChannelsByIdLineupOptions({
      path: { id: channelId },
      query: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
      },
    }),
    select: (lineup) => [lineup],
    staleTime: dayjs.duration(5, 'minutes').asMilliseconds(),
  });
}

const allLineupsQueryOpts = (params: { from: Dayjs; to: Dayjs }) => ({
  ...getApiChannelsAllLineupsOptions({
    query: {
      from: params.from.toISOString(),
      to: params.to.toISOString(),
    },
  }),
  staleTime: dayjs.duration(5, 'minutes').asMilliseconds(),
});

type UseTvGuideOpts = {
  channelId: string;
  from: Dayjs;
  to: Dayjs;
};

export const useTvGuide = (params: UseTvGuideOpts) => {
  return useQuery(
    lineupQueryOpts(params.channelId, {
      from: params.from,
      to: params.to,
    }),
  );
};

export const useChannelNowPlaying = (channelId: string) => {
  return useSuspenseQuery({
    ...getApiChannelsByIdNowPlayingOptions({ path: { id: channelId } }),
  });
};

export const useTvGuides = (
  channelId: string,
  params: { from: Dayjs; to: Dayjs },
): UseQueryResult<ChannelLineup[]> => {
  const singleChannelResult = useQuery({
    ...lineupQueryOpts(channelId, params),
    enabled: channelId !== 'all',
  });

  const allChannelsResult = useAllTvGuides(params, {
    enabled: channelId === 'all',
  });

  return channelId === 'all' ? allChannelsResult : singleChannelResult;
};

export const useTvGuidesPrefetch = (
  channelId: string,
  params: { from: Dayjs; to: Dayjs },
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (channelId === 'all') {
      queryClient
        .prefetchQuery(allLineupsQueryOpts(params))
        .catch(console.error);
    } else {
      queryClient
        .prefetchQuery({
          ...lineupQueryOpts(channelId, params),
        })
        .catch(console.error);
    }
  }, [channelId, params, queryClient]);
};

export const useAllTvGuides = (
  params: { from: Dayjs; to: Dayjs },
  extraOpts: Partial<
    StrictOmit<
      ReturnType<typeof getApiChannelsAllLineupsOptions>,
      'queryFn' | 'queryKey'
    >
  > = {},
) => {
  return useQuery({
    ...allLineupsQueryOpts(params),
    ...extraOpts,
  });
};
