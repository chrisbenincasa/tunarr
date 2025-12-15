import { Stack, Typography } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';
import { LibraryProgramGrid } from '../../../components/library/LibraryProgramGrid.tsx';
import { SearchFilterBuilder } from '../../../components/search/SearchFilterBuilder.tsx';
import { getApiSmartCollectionsByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { setSearchRequest } from '../../../store/programmingSelector/actions.ts';

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
      <SearchFilterBuilder
        onSearch={useCallback((req) => setSearchRequest(req), [])}
        initialQuery={smartCollection.query}
      />
      <LibraryProgramGrid />
    </Stack>
  );
}
