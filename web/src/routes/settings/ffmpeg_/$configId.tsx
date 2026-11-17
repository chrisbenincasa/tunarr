import { createFileRoute, redirect } from '@tanstack/react-router';

// Transcode configs moved under Profiles; keep old links working.
export const Route = createFileRoute('/settings/ffmpeg_/$configId')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/profiles/transcode/$configId',
      params: { configId: params.configId },
      replace: true,
    });
  },
});
