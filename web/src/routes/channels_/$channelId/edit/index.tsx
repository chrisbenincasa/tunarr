import { channelQuery } from '@/hooks/useChannels';
import EditChannelPage from '@/pages/channels/EditChannelPage';
import { setCurrentChannel } from '@/store/channelEditor/actions';
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

    setCurrentChannel(channel);
  },
  component: () => <EditChannelPage isNew={false} />,
});
