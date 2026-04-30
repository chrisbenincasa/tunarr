import { createFileRoute } from '@tanstack/react-router';
import { NewSchedulePage } from '../../pages/schedules/NewSchedulePage.tsx';

export const Route = createFileRoute('/schedules/new')({
  head() {
    return {
      meta: [{ title: 'New Schedule' }],
    };
  },
  component: NewSchedulePage,
});
