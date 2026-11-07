import { StreamSelectionProfilePage } from '@/pages/profiles/StreamSelectionProfilePage';
import { createFileRoute } from '@tanstack/react-router';
import { getApiStreamSelectionProfilesByIdOptions } from '../../../generated/@tanstack/react-query.gen';

export const Route = createFileRoute('/profiles/stream-selection_/$profileId')({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(
      getApiStreamSelectionProfilesByIdOptions({
        path: { id: params.profileId },
      }),
    ),
  component: () => <StreamSelectionProfilePage isNew={false} />,
});
