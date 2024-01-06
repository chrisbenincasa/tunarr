import { useQueries, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { apiClient } from '../external/api.ts';

export const useChannelLineup = (number: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['channels', number, 'lineup'],
    queryFn: () =>
      apiClient.get('/api/v2/channels/:number/lineup', {
        params: { number },
        queries: {
          from: dayjs().toISOString(),
          to: dayjs().add(2, 'days').toISOString(),
        },
      }),
    enabled,
  });
};

export const useChannelAndLineup = (number: number, enabled: boolean = true) =>
  useQueries({
    queries: [
      {
        queryKey: ['channels', number] as [string, number],
        queryFn: async () =>
          apiClient.get('/api/v2/channels/:number', {
            params: { number },
          }),
        enabled: number > 0 && enabled,
      },
      {
        queryKey: ['channels', number, 'lineup'],
        queryFn: async () =>
          apiClient.get('/api/v2/channels/:number/lineup', {
            params: { number },
            queries: {
              from: dayjs().toISOString(),
              to: dayjs().add(2, 'days').toISOString(),
            },
          }),
        enabled: number > 0 && enabled,
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
