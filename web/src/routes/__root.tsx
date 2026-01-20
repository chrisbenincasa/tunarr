import { Root } from '@/App';
import { TanStackRouterDevtools } from '@/dev/TanStackRouterDevtools';
import { ErrorPage } from '@/pages/ErrorPage';
import type { RouterContext } from '@/types/RouterContext';
import { createRootRouteWithContext } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { isNonEmptyString, search as tunarrSearch } from '@tunarr/shared/util';
import type { SearchRequest } from '@tunarr/types/schemas';
import { z } from 'zod/v4';
import { RouterLink } from '../components/base/RouterLink.tsx';
import { programSearchQueryOpts } from '../hooks/useProgramSearchQuery.ts';
import { parseSearchQuery } from '../hooks/useSearchQueryParser.ts';
import useStore from '../store/index.ts';

const searchQuerySchema = z.object({
  query: z.string().optional().catch(undefined),
});

export type RootSearchQueryParams = z.infer<typeof searchQuerySchema>;

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: zodValidator(searchQuerySchema),
  loader: async ({ context: { queryClient }, location: { search } }) => {
    console.log(search);
    const parsed = search as RootSearchQueryParams;
    if (!isNonEmptyString(parsed.query)) {
      useStore.setState((s) => {
        s.currentSearchRequest = null;
      });
      return;
    }

    const parseResult = parseSearchQuery(parsed.query);

    const searchRequest: SearchRequest = {
      query: '',
      filter: null,
      sort: null,
    };

    if (parseResult?.type === 'success') {
      searchRequest.filter = tunarrSearch.parsedSearchToRequest(
        parseResult.query,
      );
      searchRequest.query = null;
    } else {
      searchRequest.query = parsed.query;
    }

    await queryClient.prefetchInfiniteQuery(
      programSearchQueryOpts(undefined, undefined, searchRequest),
    );
    useStore.setState((s) => {
      s.currentSearchRequest = searchRequest;
    });

    return {
      searchRequest,
    };
  },
  component: RootPage,
  notFoundComponent: () => (
    <div>
      <p>Not found!</p>
      <RouterLink to="/">Go Home</RouterLink>
    </div>
  ),
  errorComponent: ({ error, reset }) => {
    return (
      <Root>
        <ErrorPage error={error} resetRoute={reset} />
        <TanStackRouterDevtools />
      </Root>
    );
  },
});

function RootPage() {
  return (
    <>
      <Root />
      <TanStackRouterDevtools />
    </>
  );
}
