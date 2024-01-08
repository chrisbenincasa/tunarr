import { QueryClient } from '@tanstack/react-query';
import { LoaderFunctionArgs } from 'react-router-dom';
import { lineupQuery } from '../../hooks/useChannelLineup.ts';
import { channelQuery } from '../../hooks/useChannels.ts';
import { Preloader } from '../../types/index.ts';
import { Channel, ChannelLineup } from 'dizquetv-types';

export const editChannelLoader: Preloader<Channel> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const query = channelQuery(parseInt(params.id!));
    console.log(query.queryKey);
    const existingChannel = queryClient.getQueryData(query.queryKey);
    console.log(
      'exisitng channel (edit page)',
      existingChannel,
      queryClient.getQueryCache().getAll(),
    );
    if (!existingChannel) {
      console.log('fetching channel query key ', query.queryKey);
      return await queryClient.fetchQuery(query);
    }
    return existingChannel;
  };

export const editProgrammingLoader: Preloader<{
  channel: Channel;
  lineup: ChannelLineup;
}> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const lineupQueryData = lineupQuery(parseInt(params.id!), null, true);
    const channelQueryData = channelQuery(parseInt(params.id!));

    console.log(channelQueryData.queryKey, lineupQueryData.queryKey);

    const lineupPromise = Promise.resolve(
      queryClient.getQueryData(lineupQueryData.queryKey),
    ).then((lineup) => {
      console.log('existing lineup', lineup);
      return lineup ?? queryClient.fetchQuery(lineupQueryData);
    });

    const channelPromise = Promise.resolve(
      queryClient.getQueryData(channelQueryData.queryKey),
    ).then((channel) => {
      console.log('existing channel', channel);
      return channel ?? queryClient.fetchQuery(channelQueryData);
    });

    return await Promise.all([channelPromise, lineupPromise]).then(
      ([channel, lineup]) => ({ channel, lineup }),
    );
  };
