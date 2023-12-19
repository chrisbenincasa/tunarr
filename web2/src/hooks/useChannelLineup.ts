import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { ChannelLineup } from 'dizquetv-types';

export const useChannelLineup = (number: number, enabled: boolean = true) => {
  const query = new URLSearchParams({
    from: dayjs().toISOString(),
    to: dayjs().add(2, 'days').toISOString(),
  }).toString();
  return useQuery({
    queryKey: ['channels', number, 'lineup'],
    queryFn: () =>
      fetch(
        `http://localhost:8000/api/v2/channels/${number}/lineup?${query}`,
      ).then((res) => res.json() as Promise<ChannelLineup>),
    enabled,
  });
};
