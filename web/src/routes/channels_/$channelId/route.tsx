import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
