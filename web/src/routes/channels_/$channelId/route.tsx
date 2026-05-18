import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_/$channelId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/channels_/$channelId"!</div>;
}
