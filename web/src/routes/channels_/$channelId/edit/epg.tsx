import { channelQuery } from '@/hooks/useChannels';
import EditChannelPage from '@/pages/channels/EditChannelPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId/edit/epg')({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      channelQuery(context.tunarrApiClientProvider(), params.channelId),
    ),
  component: () => <EditChannelPage isNew={false} initialTab="epg" />,
});
