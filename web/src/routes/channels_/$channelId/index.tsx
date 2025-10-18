import { preloadChannelAndProgramming } from '@/helpers/routeLoaders';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelSummaryPage } from '../../../pages/channels/ChannelSummaryPage.tsx';

export const Route = createFileRoute('/channels_/$channelId/')({
  loader: preloadChannelAndProgramming,
  component: ChannelSummaryPage,
});
