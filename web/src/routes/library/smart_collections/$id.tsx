import { Stack, Typography } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { search } from '@tunarr/shared/util';
import { LibraryProgramGrid } from '../../../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../../../components/search/SearchInput.tsx';
import { getApiSmartCollectionsByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { parseSearchQuery } from '../../../hooks/useSearchQueryParser.ts';

export const Route = createFileRoute('/library/smart_collections/$id')({
  loader: async ({ context, params }) => {
    const smartCollection = await context.queryClient.ensureQueryData(
      getApiSmartCollectionsByIdOptions({
        path: {
          id: params.id,
        },
      }),
    );

    const parseResult = parseSearchQuery(smartCollection.query);

    if (!parseResult || parseResult?.type === 'error') {
      // This is an error - Smart collections should be properly parseable (confirmed at save time)
      throw new Error(
        `Smart collection ${params.id} has an unparseable query: ${smartCollection.query}`,
      );
    }

    return search.parsedSearchToRequest(parseResult.query);
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const parsedQuery = Route.useLoaderData();
  const { data: smartCollection } = useSuspenseQuery(
    getApiSmartCollectionsByIdOptions({ path: { id } }),
  );
  return (
    <Stack gap={2}>
      <Typography variant="h4">
        Smart Collection: {smartCollection.name}
      </Typography>
      <SearchInput initialSearchFilter={parsedQuery} />

      <LibraryProgramGrid />
    </Stack>
  );
}
