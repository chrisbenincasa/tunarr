import { Root } from '@/App';
import { TanStackRouterDevtools } from '@/dev/TanStackRouterDevtools';
import { ErrorPage } from '@/pages/ErrorPage';
import type { RouterContext } from '@/types/RouterContext';
import { Link } from '@mui/material';
import {
  Link as RouterLink,
  createRootRouteWithContext,
  retainSearchParams,
} from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { isNonEmptyString, search as tunarrSearch } from '@tunarr/shared/util';
import type { SearchRequest } from '@tunarr/types/api';
import { z } from 'zod/v4';
import { programSearchQueryOpts } from '../hooks/useProgramSearchQuery.ts';
import { parseSearchQuery } from '../hooks/useSearchQueryParser.ts';
import useStore from '../store/index.ts';

const searchQuerySchema = z.object({
  query: z.string().optional(),
});

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: zodValidator(searchQuerySchema),
  search: {
    middlewares: [retainSearchParams(true)],
  },
  loader: async ({ context: { queryClient }, location: { search } }) => {
    const parsed = search as z.infer<typeof searchQuerySchema>;
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
  },
  component: RootPage,
  notFoundComponent: () => (
    <div>
      <p>Not found!</p>
      <Link component={RouterLink} to="/">
        Go Home
      </Link>
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
  console.log();
  return (
    <>
      <Root />
      <TanStackRouterDevtools />
    </>
  );
}
