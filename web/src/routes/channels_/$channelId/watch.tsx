import { channelQuery } from '@/hooks/useChannels';
import ChannelWatchPage from '@/pages/watch/ChannelWatchPage';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod/v4';

const watchPageSearchSchema = z.object({
  noAutoPlay: z.coerce
    .boolean()
    .or(z.string().transform((s) => s === 'true'))
    .catch(true),
});

export const Route = createFileRoute('/channels_/$channelId/watch')({
  validateSearch: (s) => watchPageSearchSchema.parse(s),
  loader: ({ params: { channelId }, context: { queryClient } }) =>
    queryClient.ensureQueryData(channelQuery(channelId)),
  component: ChannelWatchPage,
});
