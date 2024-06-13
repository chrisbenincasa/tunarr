import { preloadChannelAndProgramming } from '@/helpers/routeLoaders';
import RandomSlotEditorPage from '@/pages/channels/RandomSlotEditorPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/channels/$channelId/programming/random-slot-editor',
)({
  loader: preloadChannelAndProgramming,
  component: RandomSlotEditorPage,
});
