import {
  queryOptions,
  useQuery,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { Channel } from '@tunarr/types';
import type { StrictOmit } from 'ts-essentials';
import {
  getChannelsByNumberV2Options,
  getChannelsOptions,
} from '../generated/@tanstack/react-query.gen.ts';

export const useChannels = (initialData: Channel[] = []) => {
  return useQuery({
    ...getChannelsOptions(),
    initialData,
  });
};

export const useChannelsSuspense = (
  params?: Partial<
    StrictOmit<ReturnType<typeof getChannelsOptions>, 'queryFn' | 'queryKey'>
  >,
) => {
  return useSuspenseQuery({ ...getChannelsOptions(), ...params });
};

export const channelQuery = (id: string, enabled: boolean = true) =>
  queryOptions({
    ...getChannelsByNumberV2Options({ path: { id } }),
    enabled: id.length > 0 && enabled,
    staleTime: 10_000,
  });

export const useChannel = (
  id: string,
  enabled: boolean = true,
  initialData: Channel | undefined = undefined,
) => {
  return useQuery({ ...channelQuery(id, enabled), initialData });
};

export const useChannelSuspense = (id: string, enabled: boolean = true) => {
  return useSuspenseQuery(channelQuery(id, enabled));
};

// If we absolutely have initialData defined, we can use this hook instead,
// to eliminate the typing possiblity of "| undefined" for the resulting Channel
export const useChannelWithInitialData = (
  id: string,
  initialData: Channel,
  enabled: boolean = true,
) => {
  return useQuery({ ...channelQuery(id, enabled), initialData });
};
