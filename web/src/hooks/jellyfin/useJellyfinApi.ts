import { isNonEmptyString } from '@/helpers/util.ts';
import { addKnownMediaForServer } from '@/store/programmingSelector/actions.ts';
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { type JellyfinItemKind } from '@tunarr/types/jellyfin';
import { every, flatMap, isEmpty, isNil, omitBy, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { StrictOmit } from 'ts-essentials';
import {
  getJellyfinLibrariesOptions,
  getJellyfinLibraryGenresOptions,
} from '../../generated/@tanstack/react-query.gen.ts';
import { getJellyfinLibraryItems } from '../../generated/sdk.gen.ts';
import type { GetJellyfinLibraryItemsData } from '../../generated/types.gen.ts';
import { useQueryObserver } from '../useQueryObserver.ts';

export const useJellyfinUserLibraries = (
  mediaSourceId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getJellyfinLibrariesOptions({ path: { mediaSourceId } }),
    enabled: enabled && isNonEmptyString(mediaSourceId),
  });
};

export const useJellyfinGenres = (
  mediaSourceId: string,
  libraryId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getJellyfinLibraryGenresOptions({ path: { libraryId, mediaSourceId } }),
    enabled:
      isNonEmptyString(mediaSourceId) && isNonEmptyString(libraryId) && enabled,
    staleTime: 900_000, // 15 minutes
  });
};

function getChunkSize(
  librarySize: number,
  previousFetchSize: number,
  bufferSize: number,
): number {
  if (librarySize <= 200) {
    return previousFetchSize + bufferSize;
  } else if (librarySize <= 1000) {
    return previousFetchSize * 2 + bufferSize;
  } else {
    return previousFetchSize * 3 + bufferSize;
  }
}

export const useInfiniteJellyfinLibraryItems = (
  mediaSourceId: string,
  libraryId: string,
  parentId: string,
  itemTypes: JellyfinItemKind[],
  enabled: boolean = true,
  initialChunkSize: number = 20,
  bufferSize: number = 0,
  additionalFilters: Partial<
    StrictOmit<
      NonNullable<GetJellyfinLibraryItemsData['query']>,
      'offset' | 'limit' | 'itemTypes'
    >
  > = {},
) => {
  const lastFetchSize = initialChunkSize + bufferSize;

  const queryOpts = useMemo(
    () =>
      infiniteQueryOptions({
        queryKey: [
          'jellyfin',
          mediaSourceId,
          'library_items',
          libraryId,
          'infinite',
          { itemTypes, additionalFilters, parentId },
        ],
        queryFn: ({ pageParam: { offset, pageSize } }) =>
          getJellyfinLibraryItems({
            path: { mediaSourceId, libraryId },
            query: {
              parentId,
              offset,
              limit: pageSize,
              itemTypes: isEmpty(itemTypes) ? undefined : itemTypes,
              ...omitBy(additionalFilters, isNil),
            },
            throwOnError: true,
          }).then(({ data }) => data),
        enabled: enabled && every([mediaSourceId, parentId], isNonEmptyString),
        initialPageParam: { offset: 0, pageSize: lastFetchSize },
        getNextPageParam: (res, all, { offset: lastOffset }) => {
          const total = sumBy(all, (page) => page.result.length);
          if (total >= (res.total ?? res.result.length)) {
            return;
          }

          // Next offset is the last + how many items we got back.
          return {
            offset: (lastOffset + res.result.length) % res.total,
            pageSize: getChunkSize(res.total, initialChunkSize, bufferSize),
          };
        },
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60 * 10,
      }),
    [
      additionalFilters,
      bufferSize,
      enabled,
      initialChunkSize,
      itemTypes,
      lastFetchSize,
      libraryId,
      mediaSourceId,
      parentId,
    ],
  );

  const result = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          const allItems = flatMap(result.data.pages, (page) => page.result);
          addKnownMediaForServer(mediaSourceId, allItems, parentId);
        }
      },
      [mediaSourceId, parentId],
    ),
  );

  return { ...result, queryKey: queryOpts.queryKey };
};
