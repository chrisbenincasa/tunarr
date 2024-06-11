import { channelsQuery } from '@/hooks/useChannels';
import EditChannelPage from '@/pages/channels/EditChannelPage';
import { defaultNewChannel } from '@/preloaders/channelLoaders';
import useStore from '@/store';
import { setCurrentChannel } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';
import { Channel, CondensedChannelProgramming } from '@tunarr/types';
import { isNil, maxBy } from 'lodash-es';

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

export const Route = createFileRoute('/channels/new')({
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
  component: () => <EditChannelPage isNew={true} />,
});
