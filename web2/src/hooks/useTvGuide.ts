import { useQuery } from '@tanstack/react-query';
import { Dayjs } from 'dayjs';
import { ChannelLineup } from 'dizquetv-types';

export const useTvGuide = (params: { from: Dayjs; to: Dayjs }) =>
  useQuery({
    queryKey: ['channels', 'guide', params] as const,
    queryFn: async ({ queryKey }) => {
      const [_, _2, { from, to }] = queryKey;
      const res = await fetch(
        `http://localhost:8000/api/guide/channels?dateFrom=${from.toISOString()}&dateTo=${to.toISOString()}`,
      );
      return res.json() as Promise<Record<string, ChannelLineup>>;
    },
  });
