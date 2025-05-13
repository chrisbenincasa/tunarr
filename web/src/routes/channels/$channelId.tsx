import { preloadChannelAndProgramming } from '@/helpers/routeLoaders';
import { createFileRoute } from '@tanstack/react-router';
import { ChannelSummaryPage } from '../../pages/channels/ChannelSummaryPage.tsx';

export const Route = createFileRoute('/channels/$channelId')({
  loader: preloadChannelAndProgramming,
  component: ChannelSummaryPage,
  // loader: (ctx) => {
  //   const channelId = ctx.params.channelId;
  // throw redirect({
  //   to: '/channels/$channelId/programming',
  //   params: {
  //     channelId,
  //   },
  // });

  // },
});
