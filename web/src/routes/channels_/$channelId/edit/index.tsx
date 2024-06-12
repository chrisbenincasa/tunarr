import { channelQuery } from '@/hooks/useChannels';
import EditChannelPage from '@/pages/channels/EditChannelPage';
import { setCurrentChannel } from '@/store/channelEditor/actions';
import useStore from '@/store/index.ts';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { isUndefined } from 'lodash-es';

export const Route = createFileRoute('/channels/$channelId/edit/')({
  loader: async ({ params, context }) => {
    const channel = await context.queryClient.ensureQueryData(
      channelQuery(context.tunarrApiClientProvider(), params.channelId),
    );

    if (isUndefined(channel)) {
      throw notFound();
    }

    const currentChannel = useStore.getState().channelEditor.currentEntity;
    if (currentChannel?.id !== channel.id) {
      console.log('set', currentChannel);
      setCurrentChannel(channel);
    }

    return channel;
  },
  component: () => <EditChannelPage isNew={false} />,
});
