import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/channels_')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
