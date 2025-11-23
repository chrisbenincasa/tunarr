import type {
  DefaultError,
  QueryKey,
  UseInfiniteQueryOptions,
} from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { SearchRequest } from '@tunarr/types/api';
import { flatten, groupBy, isEmpty } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { postApiProgramsSearch } from '../generated/sdk.gen.ts';
import type { PostApiProgramsSearchResponses } from '../generated/types.gen.ts';
import { addKnownMediaForServer } from '../store/programmingSelector/actions.ts';
import type { Maybe } from '../types/util.ts';
import { useQueryObserver } from './useQueryObserver.ts';

export function programSearchQueryOpts(
  mediaSourceId: Maybe<string>,
  libraryId: Maybe<string>,
  query: SearchRequest,
) {
  const key = [
    'programs',
    'search',
    query,
    mediaSourceId,
    libraryId,
  ] satisfies QueryKey;
  const opts: UseInfiniteQueryOptions<
    PostApiProgramsSearchResponses[200],
    DefaultError,
    PostApiProgramsSearchResponses[200],
    PostApiProgramsSearchResponses[200],
    typeof key,
    number
  > = {
    queryKey: key,
    queryFn: async ({ pageParam }) => {
      const { data } = await postApiProgramsSearch({
        body: {
          mediaSourceId: mediaSourceId,
          libraryId: libraryId,
          query: query,
          limit: 45,
          page: pageParam,
        },
        throwOnError: true,
      });
      return data;
    },
    getNextPageParam: (last) => {
      const nextPage = last.page + 1;
      // We can't always trust the total hits. Meilisearch
      // by default maxes out at 1000. You can configure this
      // but it makes search slow. We just keep querying until
      // there are no more results!
      if (last.totalHits < 1_000 && nextPage > last.totalPages) {
        return;
      } else if (last.totalHits >= 1_000 && last.results.length === 0) {
        return;
      }

      return nextPage;
    },
    getPreviousPageParam: (last) => {
      const prevPage = last.page - 1;
      if (prevPage <= 0) {
        return;
      }
      return prevPage;
    },
    initialPageParam: 1,
    staleTime: 0,
  };
  return opts;
}

export const useProgramSearchQueryOpts = (
  mediaSourceId: Maybe<string>,
  libraryId: Maybe<string>,
  query: SearchRequest,
) => {
  return useMemo(() => {
    return programSearchQueryOpts(mediaSourceId, libraryId, query);
  }, [libraryId, mediaSourceId, query]);
};

export const useProgramSearchQuery = (
  mediaSourceId: Maybe<string>,
  libraryId: Maybe<string>,
  query: SearchRequest,
) => {
  const queryOpts = useProgramSearchQueryOpts(mediaSourceId, libraryId, query);
  const searchQuery = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback((result) => {
      const allResults = flatten(result.data?.results);

      if (!isEmpty(allResults)) {
        const byMediaSourceId = groupBy(
          allResults,
          (result) => result.mediaSourceId,
        );
        for (const [mediaSourceId, results] of Object.entries(
          byMediaSourceId,
        )) {
          addKnownMediaForServer(mediaSourceId, results);
        }
      }
    }, []),
  );
  return searchQuery;
};
