import { channelQuery } from '@/hooks/useChannels';
import EditChannelPage from '@/pages/channels/EditChannelPage';
import { setCurrentChannel } from '@/store/channelEditor/actions';
import useStore from '@/store/index.ts';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { isUndefined } from 'lodash-es';
import { z } from 'zod';

// TODO: Share this schema between new and edit routes
const editChannelParamsSchema = z.object({
  tab: z
    .union([z.literal('flex'), z.literal('epg'), z.literal('ffmpeg')])
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute('/channels/$channelId/edit/')({
  validateSearch: (search) => editChannelParamsSchema.parse(search),
  loader: async ({ params, context }) => {
    const channel = await context.queryClient.ensureQueryData(
      channelQuery(context.tunarrApiClientProvider(), params.channelId),
    );

    if (isUndefined(channel)) {
      throw notFound();
    }

    const currentChannel = useStore.getState().channelEditor.currentEntity;
    if (currentChannel?.id !== channel.id) {
      setCurrentChannel(channel);
    }

    return channel;
  },
  component: EditChannelPageWrapper,
});

function EditChannelPageWrapper() {
  const { tab } = Route.useSearch();
  return <EditChannelPage initialTab={tab ?? 'properties'} />;
}
