import { QueryClient } from '@tanstack/react-query';
import { Channel, ChannelProgramming } from 'dizquetv-types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { lineupQuery } from '../../hooks/useChannelLineup.ts';
import { channelQuery, channelsQuery } from '../../hooks/useChannels.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';
import { Preloader } from '../../types/index.ts';

export const editChannelLoader: Preloader<Channel> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const query = channelQuery(parseInt(params.id!));
    let channel = queryClient.getQueryData(query.queryKey);
    if (!channel) {
      channel = await queryClient.fetchQuery(query);
    }

    setCurrentChannel(channel!, []);
    return channel!;
  };

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

export const newChannelLoader: Preloader<Channel[]> =
  (queryClient: QueryClient) => async () => {
    let channels = queryClient.getQueryData(channelsQuery.queryKey);
    if (!channels) {
      channels = await queryClient.fetchQuery(channelsQuery);
    }

    return channels!;
  };
