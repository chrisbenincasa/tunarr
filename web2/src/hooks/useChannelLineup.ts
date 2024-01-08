import { DataTag, useQueries, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Channel, ChannelLineup } from 'dizquetv-types';
import { apiClient } from '../external/api.ts';
import { channelQuery } from './useChannels.ts';

export const lineupQuery = (
  number: number,
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null,
  enabled: boolean,
) => {
  const dateRangeKey = `${dateRange?.start?.unix() ?? 'null'}_${
    dateRange?.end?.unix() ?? 'null'
  }`;
  return {
    queryKey: ['channels', number, 'lineup', dateRangeKey] as DataTag<
      ['channels', number, 'lineup', string],
      ChannelLineup
    >,
    queryFn: async () =>
      apiClient.get('/api/v2/channels/:number/lineup', {
        params: { number },
        queries: {
          from: dateRange?.start.toISOString(),
          to: dateRange?.end.toISOString(),
        },
      }),
    enabled: number > 0 && enabled,
  };
};

export const useChannelLineup = (number: number, enabled: boolean = true) => {
  return useQuery(
    lineupQuery(
      number,
      {
        start: dayjs(),
        end: dayjs().add(2, 'days'),
      },
      enabled,
    ),
  );
};

export const useChannelAndLineup = (
  number: number,
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null,
  enabled: boolean = true,
  initialData?: { channel?: Channel; lineup?: ChannelLineup },
) =>
  useQueries({
    queries: [
      { ...channelQuery(number, enabled), initialData: initialData?.channel },
      {
        ...lineupQuery(number, dateRange, enabled),
        initialData: initialData?.lineup,
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
