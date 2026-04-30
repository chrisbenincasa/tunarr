import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/channels')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
