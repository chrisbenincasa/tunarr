import { ApiClient } from '@/external/api.ts';
import {
  queryOptions,
  useQueries,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { channelsQuery } from './useChannels.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const channelSessionsQueryOptions = (api: ApiClient) =>
  queryOptions({
    queryKey: ['channels', 'sessions'],
    queryFn() {
      return api.getAllChannelSessions();
    },
    staleTime: 10_000,
  });

export const useChannelSessions = () => {
  const api = useTunarrApi();
  return useQuery(channelSessionsQueryOptions(api));
};

export const useSuspenseChannelSessions = () => {
  const api = useTunarrApi();
  return useSuspenseQuery(channelSessionsQueryOptions(api));
};

export const useChannelsAndSessions = () => {
  const api = useTunarrApi();
  return useQueries({
    queries: [channelsQuery(api, undefined), channelSessionsQueryOptions(api)],
  });
};
