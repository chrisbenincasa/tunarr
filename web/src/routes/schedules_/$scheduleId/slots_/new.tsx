import { createFileRoute } from '@tanstack/react-router';
import { loadSchedule } from '../../../../helpers/routeLoaders.ts';
import { EditScheduleSlot } from '../../../../pages/schedules/EditScheduleSlot.tsx';

export const Route = createFileRoute('/schedules/$scheduleId/slots/new')({
  loader: ({ context, params }) => loadSchedule(context)(params.scheduleId),
  head: () => ({
    meta: [{ title: 'New Slot' }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const schedule = Route.useLoaderData();
  return <EditScheduleSlot schedule={schedule} />;
}
