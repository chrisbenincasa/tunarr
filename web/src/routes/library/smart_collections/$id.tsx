import { Stack, Typography } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { LibrarySearch } from '../../../components/library/LibrarySearch.tsx';
import { getApiSmartCollectionsByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/library/smart_collections/$id')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(
      getApiSmartCollectionsByIdOptions({
        path: {
          id: params.id,
        },
      }),
    );
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { data: smartCollection } = useSuspenseQuery(
    getApiSmartCollectionsByIdOptions({ path: { id } }),
  );
  return (
    <Stack gap={2}>
      <Typography variant="h4">
        Smart Collection: {smartCollection.name}
      </Typography>
      <LibrarySearch
        disableProgramSelection
        initialSearchQuery={smartCollection.query}
      />
    </Stack>
  );
}
