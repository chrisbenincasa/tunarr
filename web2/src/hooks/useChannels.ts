import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';
import { Channel } from 'dizquetv-types';

export const useChannels = () =>
  useQuery({
    queryKey: ['channels'],
    queryFn: () => apiClient.get('/api/v2/channels') as Promise<Channel[]>,
  });
