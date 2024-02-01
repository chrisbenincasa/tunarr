import { DataTag, useQueries, useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Channel, ChannelLineup } from '@tunarr/types';
import { apiClient } from '../external/api.ts';
import { channelQuery } from './useChannels.ts';

export const lineupQuery = (
  id: string,
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null,
  enabled: boolean,
) => {
  const dateRangeKey = `${dateRange?.start?.unix() ?? 'null'}_${
    dateRange?.end?.unix() ?? 'null'
  }`;
  return {
    queryKey: ['channels', id, 'programming', dateRangeKey] as DataTag<
      ['channels', string, 'programming', string],
      ChannelLineup
    >,
    queryFn: async () =>
      apiClient.get('/api/v2/channels/:id/programming', {
        params: { id },
        queries: {
          from: dateRange?.start.toISOString(),
          to: dateRange?.end.toISOString(),
        },
      }),
    enabled: id.length > 0 && enabled,
  };
};

export const useChannelLineup = (id: string, enabled: boolean = true) => {
  return useQuery(
    lineupQuery(
      id,
      {
        start: dayjs(),
        end: dayjs().add(2, 'days'),
      },
      enabled,
    ),
  );
};

export const useChannelAndLineup = (
  id: string,
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs } | null,
  enabled: boolean = true,
  initialData?: { channel?: Channel; lineup?: ChannelLineup },
) =>
  useQueries({
    queries: [
      { ...channelQuery(id, enabled), initialData: initialData?.channel },
      {
        ...lineupQuery(id, dateRange, enabled),
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
