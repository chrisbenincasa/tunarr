import { preloadFillerAndProgramming } from '@/helpers/routeLoaders.ts';
import EditFillerPage from '@/pages/library/EditFillerPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/fillers/$fillerId/edit')({
  loader: preloadFillerAndProgramming,
  component: EditFillerPage,
});
