import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/schedules_/$scheduleId')({
  component: RouteComponent,
});

function RouteComponent() {
  return <Outlet />;
}
