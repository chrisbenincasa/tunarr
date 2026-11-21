import { legacyPlaylistRedirect } from '@/helpers/legacyPlaylistRedirect';
import { createFileRoute, redirect } from '@tanstack/react-router';

// Custom shows were renamed to playlists. This keeps old deep links working.
export const Route = createFileRoute('/library/custom-shows_/$')({
  beforeLoad: ({ params }) => {
    throw redirect({ ...legacyPlaylistRedirect(params._splat), replace: true });
  },
});
