import { preloadCustomShowAndProgramming } from '@/helpers/routeLoaders.ts';
import EditCustomShowPage from '@/pages/library/EditCustomShowPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/custom-shows_/$showId/edit')({
  loader: preloadCustomShowAndProgramming,
  component: EditCustomShowPage,
});
