import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/schedules')({
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
