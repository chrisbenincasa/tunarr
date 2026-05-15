import StreamSelectionProfilesPage from '@/pages/profiles/StreamSelectionProfilesPage';
import { createFileRoute } from '@tanstack/react-router';
import { getApiStreamSelectionProfilesOptions } from '../../generated/@tanstack/react-query.gen';

export const Route = createFileRoute('/profiles/stream-selection')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(getApiStreamSelectionProfilesOptions()),
  component: StreamSelectionProfilesPage,
});
