import { Root } from '@/App';
import { TanStackRouterDevtools } from '@/dev/TanStackRouterDevtools';
import { ErrorPage } from '@/pages/ErrorPage';
import type { RouterContext } from '@/types/RouterContext';
import { Link } from '@mui/material';
import {
  Link as RouterLink,
  createRootRouteWithContext,
} from '@tanstack/react-router';
import { search } from '@tunarr/shared/util';
import type { SearchRequest } from '@tunarr/types/api';
import { isEmpty, isUndefined } from 'lodash-es';
import { z } from 'zod/v4';
import { parseSearchQuery } from '../hooks/useSearchQueryParser.ts';
import useStore from '../store/index.ts';

const searchQuerySchema = z.object({
  query: z.string().optional(),
});

export const Route = createRootRouteWithContext<RouterContext>()({
  validateSearch: (searchParams) => {
    const { query: searchString } = searchQuerySchema.parse(searchParams);
    if (isUndefined(searchString) || isEmpty(searchString)) {
      useStore.setState((s) => {
        s.currentSearchRequest = null;
      });
      return;
    }

    const parseResult = parseSearchQuery(searchString);

    const searchRequest: SearchRequest = {
      query: '',
      filter: null,
      sort: null,
    };

    if (parseResult?.type === 'success') {
      searchRequest.filter = search.parsedSearchToRequest(parseResult.query);
      searchRequest.query = null;
    } else {
      searchRequest.query = searchString;
    }

    useStore.setState((s) => {
      s.currentSearchRequest = searchRequest;
    });

    return {
      query: searchString,
    };
  },
  component: () => (
    <>
      <Root />
      <TanStackRouterDevtools />
    </>
  ),
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
