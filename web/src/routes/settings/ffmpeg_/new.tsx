import { createFileRoute, redirect } from '@tanstack/react-router';

// Transcode configs moved under Profiles; keep old links working.
export const Route = createFileRoute('/settings/ffmpeg_/new')({
  beforeLoad: () => {
    throw redirect({ to: '/profiles/transcode/new', replace: true });
  },
});
