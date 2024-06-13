import { preloadChannelAndProgramming } from '@/helpers/routeLoaders';
import TimeSlotEditorPage from '@/pages/channels/TimeSlotEditorPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/channels/$channelId/programming/time-slot-editor',
)({
  loader: preloadChannelAndProgramming,
  component: TimeSlotEditorPage,
});
