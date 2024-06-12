import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId/programming/add')({
  component: ProgrammingSelectorPage,
});
