import { createFileRoute } from '@tanstack/react-router';
import { SchedulesPage } from '../../pages/schedules/SchedulesPage.tsx';

export const Route = createFileRoute('/schedules_/')({
  component: SchedulesPage,
});
