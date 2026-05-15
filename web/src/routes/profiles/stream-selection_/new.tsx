import { StreamSelectionProfilePage } from '@/pages/profiles/StreamSelectionProfilePage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/profiles/stream-selection_/new')({
  component: () => <StreamSelectionProfilePage isNew />,
});
