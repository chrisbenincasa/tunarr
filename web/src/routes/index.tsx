import GuidePage from '@/pages/guide/GuidePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: () => <GuidePage channelId="all" />,
});
