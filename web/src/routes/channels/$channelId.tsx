import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId')({
  loader: (ctx) => {
    const channelId = ctx.params.channelId;
    throw redirect({
      to: '/channels/$channelId/programming',
      params: {
        channelId,
      },
    });
  },
});
