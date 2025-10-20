import { channelQuery } from '@/hooks/useChannels';
import EditChannelPage from '@/pages/channels/EditChannelPage';
import { safeSetCurrentChannel } from '@/store/channelEditor/actions';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { isUndefined } from 'lodash-es';
import { z } from 'zod/v4';

// TODO: Share this schema between new and edit routes
const editChannelParamsSchema = z.object({
  tab: z.enum(['flex', 'epg', 'ffmpeg']).optional().catch(undefined),
});

export const Route = createFileRoute('/channels_/$channelId/edit/')({
  validateSearch: (search) => editChannelParamsSchema.parse(search),
  loader: async ({ params, context }) => {
    const channel = await context.queryClient.ensureQueryData(
      channelQuery(params.channelId),
    );

    if (isUndefined(channel)) {
      throw notFound();
    }

    safeSetCurrentChannel(channel);

    return channel;
  },
  component: EditChannelPageWrapper,
});

function EditChannelPageWrapper() {
  const { tab } = Route.useSearch();
  return <EditChannelPage initialTab={tab ?? 'properties'} />;
}
