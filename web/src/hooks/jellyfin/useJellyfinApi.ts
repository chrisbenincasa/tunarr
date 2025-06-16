import { isNonEmptyString } from '@/helpers/util.ts';
import { addKnownMediaForJellyfinServer } from '@/store/programmingSelector/actions.ts';
import { type QueryParamTypeForAlias } from '@/types/index.ts';
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { type JellyfinItemKind } from '@tunarr/types/jellyfin';
import { type MediaSourceId } from '@tunarr/types/schemas';
import { every, flatMap, isEmpty, isNil, omitBy, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { useApiQuery } from '../useApiQuery.ts';
import { useQueryObserver } from '../useQueryObserver.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

export const useJellyfinUserLibraries = (
  mediaSourceId: string,
  enabled: boolean = true,
) => {
  return useApiQuery({
    queryKey: ['jellyfin', mediaSourceId, 'user_libraries'],
    queryFn: (apiClient) =>
      apiClient.getJellyfinUserLibraries({ params: { mediaSourceId } }),
    enabled: enabled && isNonEmptyString(mediaSourceId),
  });
};

export const useJellyfinLibraryItems = (
  mediaSourceId: MediaSourceId,
  parentId: string,
  itemTypes: JellyfinItemKind[],
  pageParams: { offset: number; limit: number } | null = null,
  enabled: boolean = true,
) => {
  const apiClient = useTunarrApi();

  const queryOpts = useMemo(() => {
    return queryOptions({
      queryKey: [
        'jellyfin',
        mediaSourceId,
        'library_items',
        parentId,
        pageParams,
      ],
      queryFn: () =>
        apiClient.getJellyfinItems({
          params: { mediaSourceId, libraryId: parentId },
          queries: {
            offset: pageParams?.offset,
            limit: pageParams?.limit,
            itemTypes: isEmpty(itemTypes) ? undefined : itemTypes,
            sortBy: ['IsFolder', 'SortName'],
          },
        }),
      enabled: enabled && every([mediaSourceId, parentId], isNonEmptyString),
    });
  }, [apiClient, enabled, itemTypes, mediaSourceId, pageParams, parentId]);

  const result = useQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          addKnownMediaForJellyfinServer(
            mediaSourceId,
            result.data.Items,
            parentId,
          );
        }
      },
      [mediaSourceId, parentId],
    ),
  );

  return { ...result, queryKey: queryOpts.queryKey };
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
  mediaSourceId: MediaSourceId,
  parentId: string,
  itemTypes: JellyfinItemKind[],
  enabled: boolean = true,
  initialChunkSize: number = 20,
  bufferSize: number = 0,
  additionalFilters: Partial<
    Omit<
      QueryParamTypeForAlias<'getJellyfinItems'>,
      'offset' | 'limit' | 'itemTypes'
    >
  > = {},
) => {
  const apiClient = useTunarrApi();

  const lastFetchSize = initialChunkSize + bufferSize;

  const queryOpts = useMemo(
    () =>
      infiniteQueryOptions({
        queryKey: [
          'jellyfin',
          mediaSourceId,
          'library_items',
          parentId,
          'infinite',
          { itemTypes, additionalFilters },
        ],
        queryFn: ({ pageParam: { offset, pageSize } }) =>
          apiClient.getJellyfinItems({
            params: { mediaSourceId, libraryId: parentId },
            queries: {
              offset,
              limit: pageSize,
              itemTypes: isEmpty(itemTypes) ? undefined : itemTypes,
              ...omitBy(additionalFilters, isNil),
            },
          }),
        enabled: enabled && every([mediaSourceId, parentId], isNonEmptyString),
        initialPageParam: { offset: 0, pageSize: lastFetchSize },
        getNextPageParam: (res, all, { offset: lastOffset }) => {
          const total = sumBy(all, (page) => page.Items.length);
          if (total >= (res.TotalRecordCount ?? res.Items.length)) {
            return null;
          }

          // Next offset is the last + how many items we got back.
          return {
            offset: (lastOffset + res.Items.length) % res.TotalRecordCount,
            pageSize: getChunkSize(
              res.TotalRecordCount,
              initialChunkSize,
              bufferSize,
            ),
          };
        },
        refetchOnWindowFocus: false,
        staleTime: 1000 * 60 * 60 * 10,
      }),
    [
      additionalFilters,
      apiClient,
      bufferSize,
      enabled,
      initialChunkSize,
      itemTypes,
      lastFetchSize,
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
          const allItems = flatMap(result.data.pages, (page) => page.Items);
          addKnownMediaForJellyfinServer(mediaSourceId, allItems, parentId);
        }
      },
      [mediaSourceId, parentId],
    ),
  );

  return { ...result, queryKey: queryOpts.queryKey };
};
