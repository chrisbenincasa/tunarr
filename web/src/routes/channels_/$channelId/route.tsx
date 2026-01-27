import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_/$channelId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
