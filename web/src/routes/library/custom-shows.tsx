import { customShowsQuery } from '@/hooks/useCustomShows';
import CustomShowsPage from '@/pages/library/CustomShowsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/custom-shows')({
  loader: ({ context: { queryClient, tunarrApiClientProvider } }) =>
    queryClient.ensureQueryData(customShowsQuery(tunarrApiClientProvider())),
  component: CustomShowsPage,
});
