import {
  DataTag,
  QueryClient,
  QueryKey,
  UseQueryOptions,
} from '@tanstack/react-query';
import { Channel, ChannelProgramming, CustomShow } from 'dizquetv-types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { lineupQuery } from '../../hooks/useChannelLineup.ts';
import { channelQuery, channelsQuery } from '../../hooks/useChannels.ts';
import { useCustomShowsQuery } from '../../hooks/useCustomShows.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import { Preloader } from '../../types/index.ts';

function createPreloader<T>(
  query: (
    args: LoaderFunctionArgs,
  ) => UseQueryOptions<T, Error, T, DataTag<QueryKey, T>>,
  callback: (data: T) => void = () => {},
): Preloader<T> {
  return (queryClient: QueryClient) => async (args) => {
    const qk = query(args);
    let data = queryClient.getQueryData(qk.queryKey);
    if (!data) {
      data = await queryClient.fetchQuery(qk);
    }
    callback(data);
    return data;
  };
}

export const editChannelLoader = createPreloader<Channel>(
  ({ params }) => channelQuery(parseInt(params.id!)),
  (channel) => setCurrentChannel(channel, []),
);

export const editProgrammingLoader: Preloader<{
  channel: Channel;
  lineup: ChannelProgramming;
}> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const lineupQueryData = lineupQuery(parseInt(params.id!), null, true);
    const channelQueryData = channelQuery(parseInt(params.id!));

    const lineupPromise = Promise.resolve(
      queryClient.getQueryData(lineupQueryData.queryKey),
    ).then((lineup) => {
      return lineup ?? queryClient.fetchQuery(lineupQueryData);
    });

    const channelPromise = Promise.resolve(
      queryClient.getQueryData(channelQueryData.queryKey),
    ).then((channel) => {
      return channel ?? queryClient.fetchQuery(channelQueryData);
    });

    return await Promise.all([channelPromise, lineupPromise]).then(
      ([channel, lineup]) => {
        setCurrentChannel(channel, lineup.programs);
        return {
          channel,
          lineup,
        };
      },
    );
  };

export const newChannelLoader: Preloader<Channel[]> = createPreloader(
  () => channelsQuery,
);

export const customShowsLoader: Preloader<CustomShow[]> = createPreloader(
  () => useCustomShowsQuery,
);
