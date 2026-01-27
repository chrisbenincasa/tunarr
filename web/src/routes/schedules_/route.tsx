import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/schedules_')({
  component: RouteComponent,
  head() {
    return {
      meta: [{ title: 'Schedules' }],
    };
  },
});

function RouteComponent() {
  return <Outlet />;
}
