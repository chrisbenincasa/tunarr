import { DefaultChannel } from '@/helpers/constants';
import { channelsQuery } from '@/hooks/useChannels';
import { NewChannelPage } from '@/pages/channels/NewChannelPage';
import { safeSetCurrentChannel } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';
import { Channel } from '@tunarr/types';
import { maxBy } from 'lodash-es';
import { v4 } from 'uuid';
import { z } from 'zod';
import dayjs from 'dayjs';

function defaultNewChannel(num: number): Channel {
  return {
    id: v4(),
    name: `Channel ${num}`,
    number: num,
    startTime: dayjs().add(1, 'h').startOf('h').unix() * 1000,
    ...DefaultChannel,
  };
}

// TODO: Share this schema between new and edit routes
const editChannelParamsSchema = z.object({
  tab: z
    .union([z.literal('flex'), z.literal('epg'), z.literal('ffmpeg')])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/channels/new')({
  validateSearch: (search) => editChannelParamsSchema.parse(search),
  loader: async ({ context }) => {
    const channels = await context.queryClient.ensureQueryData(
      channelsQuery(context.tunarrApiClientProvider()),
    );
    const newChannel = defaultNewChannel(
      (maxBy(channels, (c) => c.number)?.number ?? 0) + 1,
    );

    safeSetCurrentChannel(newChannel);

    return newChannel;
  },
  component: () => <NewChannelPage />,
});
