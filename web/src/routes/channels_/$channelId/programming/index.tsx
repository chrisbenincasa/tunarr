import { channelProgrammingQuery } from '@/hooks/useChannelLineup';
import { channelQuery } from '@/hooks/useChannels';
import ChannelProgrammingPage from '@/pages/channels/ChannelProgrammingPage';
import { setCurrentChannel } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId/programming/')({
  loader: async ({ params, context }) => {
    const [channel, programming] = await Promise.all([
      context.queryClient.ensureQueryData(
        channelQuery(context.tunarrApiClientProvider(), params.channelId),
      ),
      context.queryClient.ensureQueryData(
        channelProgrammingQuery(
          context.tunarrApiClientProvider(),
          params.channelId,
          true,
        ),
      ),
    ]);

    setCurrentChannel(channel, programming);
  },
  component: () => <ChannelProgrammingPage />,
});
