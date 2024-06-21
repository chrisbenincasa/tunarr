import { channelsQuery } from '@/hooks/useChannels';
import ChannelsPage from '@/pages/channels/ChannelsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/')({
  loader: ({ context: { queryClient, tunarrApiClientProvider } }) =>
    queryClient.ensureQueryData(channelsQuery(tunarrApiClientProvider())),
  component: ChannelsPage,
});
