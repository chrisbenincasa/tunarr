import { Stack, Typography } from '@mui/material';
import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { SearchRequest } from '@tunarr/types/schemas';
import { LibraryProgramGrid } from '../../../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../../../components/search/SearchInput.tsx';
import { getApiSmartCollectionsByIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { programSearchQueryOpts } from '../../../hooks/useProgramSearchQuery.ts';
import useStore from '../../../store/index.ts';

export const Route = createFileRoute('/library/smart_collections/$id')({
  loader: async ({ context: { queryClient }, params }) => {
    const smartCollection = await queryClient.ensureQueryData(
      getApiSmartCollectionsByIdOptions({
        path: {
          id: params.id,
        },
      }),
    );

    const searchRequest: SearchRequest = {
      filter: smartCollection.filter,
      query: isNonEmptyString(smartCollection.keywords)
        ? smartCollection.keywords
        : undefined,
    };
    await queryClient.prefetchInfiniteQuery(
      programSearchQueryOpts(undefined, undefined, searchRequest),
    );

    useStore.setState((s) => {
      s.currentSearchRequest = searchRequest;
    });

    return searchRequest;
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { filter, query } = Route.useLoaderData();
  const { data: smartCollection } = useSuspenseQuery(
    getApiSmartCollectionsByIdOptions({ path: { id } }),
  );
  return (
    <Stack gap={2}>
      <Typography variant="h4">
        Smart Collection: {smartCollection.name}
      </Typography>
      <SearchInput
        initialSearchFilter={filter ?? undefined}
        initialKeywords={query ?? undefined}
      />
      <LibraryProgramGrid />
    </Stack>
  );
}
