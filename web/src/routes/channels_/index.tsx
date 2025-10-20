import ChannelsPage from '@/pages/channels/ChannelsPage';
import { createFileRoute } from '@tanstack/react-router';
import { getChannelsOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/channels_/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(getChannelsOptions()),
  component: ChannelsPage,
});
