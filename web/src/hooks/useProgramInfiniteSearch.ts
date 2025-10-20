import { useInfiniteQuery } from '@tanstack/react-query';
import type { SearchRequest } from '@tunarr/types/api';
import { postApiProgramsSearchInfiniteOptions } from '../generated/@tanstack/react-query.gen.ts';

export const useProgramInfiniteSearch = (
  searchRequest: SearchRequest,
  enabled: boolean = true,
) => {
  return useInfiniteQuery({
    ...postApiProgramsSearchInfiniteOptions({
      body: {
        query: searchRequest,
      },
    }),
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
    enabled,
  });
};
