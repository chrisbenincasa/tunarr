import { createFileRoute } from '@tanstack/react-router';
import { loadScheduleSlot } from '../../../../helpers/routeLoaders.ts';
import { EditScheduleSlot } from '../../../../pages/schedules/EditScheduleSlot.tsx';

export const Route = createFileRoute('/schedules/$scheduleId/slots/$id')({
  loader: ({ context, params }) =>
    loadScheduleSlot(context)(params.scheduleId, params.id),
  head: () => ({
    meta: [{ title: 'Edit Slot' }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const { schedule, slot } = Route.useLoaderData();
  return <EditScheduleSlot schedule={schedule} slot={slot} />;
}
