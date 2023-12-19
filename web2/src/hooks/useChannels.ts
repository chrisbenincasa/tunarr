import { useQuery } from '@tanstack/react-query';
import { Channel } from 'dizquetv-types';

export const useChannels = () =>
  useQuery({
    queryKey: ['channels'],
    queryFn: () =>
      fetch('http://localhost:8000/api/v2/channels').then(
        (res) => res.json() as Promise<Channel[]>,
      ),
  });
