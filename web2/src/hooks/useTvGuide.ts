import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { apiClient } from '../external/api.ts';

export const useTvGuide = (params: {
  number: number;
  from: Dayjs;
  to: Dayjs;
}) =>
  useQuery({
    queryKey: ['channels', params.number, 'guide', params] as const,
    queryFn: async () => {
      return apiClient.get('/api/v2/channels/:number/lineup', {
        params: { number: params.number },
        queries: {
          from: params.from.toISOString(),
          to: params.to.toISOString(),
        },
      });
    },
  });

export const useAllTvGuides = (params: { from: Dayjs; to: Dayjs }) =>
  useQuery({
    queryKey: ['channels', 'all', 'guide', params] as const,
    queryFn: async () => {
      return apiClient.get('/api/v2/channels/all/lineups', {
        queries: {
          from: params.from.toISOString(),
          to: params.to.toISOString(),
        },
      });
    },
  });
