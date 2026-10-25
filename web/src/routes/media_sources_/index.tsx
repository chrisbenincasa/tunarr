import { createFileRoute, redirect } from '@tanstack/react-router';

// Sources lives under Settings. This keeps old links and bookmarks working.
export const Route = createFileRoute('/media_sources_/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/sources', replace: true });
  },
});
