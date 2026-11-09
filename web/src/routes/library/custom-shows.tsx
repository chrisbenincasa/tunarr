import { createFileRoute, redirect } from '@tanstack/react-router';

// Custom shows were renamed to playlists. This keeps old links and bookmarks working.
export const Route = createFileRoute('/library/custom-shows')({
  beforeLoad: () => {
    throw redirect({ to: '/library/playlists', replace: true });
  },
});
