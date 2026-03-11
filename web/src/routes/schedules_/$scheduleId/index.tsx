import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, notFound } from '@tanstack/react-router';
import { isAxiosError } from 'axios';
import { getScheduleByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { EditSchedulePage } from '../../../pages/schedules/EditSchedulePage.tsx';

export const Route = createFileRoute('/schedules_/$scheduleId/')({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData({
        ...getScheduleByIdOptions({ path: { id: params.scheduleId } }),
      });
    } catch (e) {
      console.error(e);
      if (isAxiosError(e) && e.status === 404) {
        throw notFound();
      }
      throw e;
    }
  },
  head: (ctx) => ({
    meta: [{ title: ctx.loaderData?.name ?? 'Schedule' }],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  const { data: schedule } = useSuspenseQuery({
    ...getScheduleByIdOptions({ path: { id: params.scheduleId } }),
  });
  return <EditSchedulePage schedule={schedule} />;
}
