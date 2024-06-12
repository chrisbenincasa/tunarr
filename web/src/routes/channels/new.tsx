import { channelsQuery } from '@/hooks/useChannels';
import { NewChannelPage } from '@/pages/channels/NewChannelPage';
import { defaultNewChannel } from '@/preloaders/channelLoaders';
import useStore from '@/store';
import { setCurrentChannel } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';
import { Channel, CondensedChannelProgramming } from '@tunarr/types';
import { isNil, maxBy } from 'lodash-es';
import { z } from 'zod';

// Returns whether the state was updated
function updateChannelState(
  channel: Channel,
  programming?: CondensedChannelProgramming,
): boolean {
  const currentState = useStore.getState().channelEditor;

  // Only set state on initial load
  if (
    isNil(currentState.originalEntity) ||
    channel.id !== currentState.originalEntity.id
  ) {
    setCurrentChannel(channel, programming);
    return true;
  }

  return false;
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

    updateChannelState(newChannel);

    return newChannel;
  },
  component: () => <NewChannelPage />,
});
