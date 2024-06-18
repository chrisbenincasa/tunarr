import { fillerListsQuery } from '@/hooks/useFillerLists';
import FillerListsPage from '@/pages/library/FillerListsPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/fillers')({
  loader: ({ context: { queryClient, tunarrApiClientProvider } }) =>
    queryClient.ensureQueryData(fillerListsQuery(tunarrApiClientProvider())),
  component: FillerListsPage,
});
