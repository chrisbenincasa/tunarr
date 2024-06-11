import ChannelsPage from '@/pages/channels/ChannelsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/')({
  component: ChannelsPage,
});
