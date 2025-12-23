import { isNonEmptyString } from '@/helpers/util.ts';
import { addKnownMediaForServer } from '@/store/programmingSelector/actions.ts';
import {
  infiniteQueryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { type EmbyItemKind } from '@tunarr/types/emby';
import { every, flatMap, isEmpty, isNil, omitBy, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { StrictOmit } from 'ts-essentials';
import { getApiEmbyByMediaSourceIdUserLibrariesOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems } from '../../generated/sdk.gen.ts';
import type { GetApiEmbyByMediaSourceIdLibrariesByLibraryIdItemsData } from '../../generated/types.gen.ts';
import { Emby } from '../../helpers/constants.ts';
import { useQueryObserver } from '../useQueryObserver.ts';

export const useEmbyUserLibraries = (
  mediaSourceId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getApiEmbyByMediaSourceIdUserLibrariesOptions({
      path: { mediaSourceId },
    }),
    enabled: enabled && isNonEmptyString(mediaSourceId),
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

export const useInfiniteEmbyLibraryItems = (
  mediaSourceId: string,
  libraryId: string,
  parentId: string,
  itemTypes: EmbyItemKind[],
  enabled: boolean = true,
  initialChunkSize: number = 20,
  bufferSize: number = 0,
  additionalFilters: Partial<
    StrictOmit<
      NonNullable<
        GetApiEmbyByMediaSourceIdLibrariesByLibraryIdItemsData['query']
      >,
      'offset' | 'limit' | 'itemTypes'
    >
  > = {},
) => {
  const lastFetchSize = initialChunkSize + bufferSize;

  const queryOpts = useMemo(
    () =>
      infiniteQueryOptions({
        queryKey: [
          Emby,
          mediaSourceId,
          'library_items',
          libraryId,
          'infinite',
          { itemTypes, additionalFilters, parentId },
        ],
        queryFn: ({ pageParam: { offset, pageSize } }) =>
          getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems({
            path: {
              mediaSourceId,
              libraryId,
            },
            query: {
              parentId,
              offset,
              limit: pageSize,
              itemTypes: isEmpty(itemTypes) ? undefined : itemTypes,
              ...omitBy(additionalFilters, isNil),
            },
            throwOnError: true,
          }).then(({ data }) => data),
        enabled: enabled && every([mediaSourceId, libraryId], isNonEmptyString),
        initialPageParam: { offset: 0, pageSize: lastFetchSize },
        getNextPageParam: (res, all, { offset: lastOffset }) => {
          const total = sumBy(all, (page) => page.size);
          if (total >= (res.total ?? res.size)) {
            return null;
          }

          // Next offset is the last + how many items we got back.
          return {
            offset: (lastOffset + res.size) % res.total,
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
