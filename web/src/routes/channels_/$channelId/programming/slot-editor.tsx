import { preloadChannelAndProgramming } from '@/helpers/routeLoaders';
import RandomSlotEditorPage from '@/pages/channels/RandomSlotEditorPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/channels_/$channelId/programming/slot-editor',
)({
  loader: preloadChannelAndProgramming,
  component: RandomSlotEditorPage,
});
