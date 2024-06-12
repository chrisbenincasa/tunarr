import { channelQuery } from '@/hooks/useChannels';
import ChannelWatchPage from '@/pages/watch/ChannelWatchPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId/watch')({
  loader: ({
    params: { channelId },
    context: { queryClient, tunarrApiClientProvider },
  }) =>
    queryClient.ensureQueryData(
      channelQuery(tunarrApiClientProvider(), channelId),
    ),
  component: ChannelWatchPage,
});
