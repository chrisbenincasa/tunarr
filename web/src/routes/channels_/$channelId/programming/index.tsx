import { preloadChannelAndProgramming } from '@/helpers/routeLoaders';
import ChannelProgrammingPage from '@/pages/channels/ChannelProgrammingPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_/$channelId/programming/')({
  loader: preloadChannelAndProgramming,
  component: () => <ChannelProgrammingPage />,
});
