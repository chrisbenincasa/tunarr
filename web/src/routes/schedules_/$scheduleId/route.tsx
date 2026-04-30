import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/schedules/$scheduleId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
