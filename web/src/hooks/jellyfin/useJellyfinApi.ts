import { isNonEmptyString } from '@/helpers/util.ts';
import { addKnownMediaForJellyfinServer } from '@/store/programmingSelector/actions.ts';
import { QueryParamTypeForAlias } from '@/types/index.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { JellyfinItemKind } from '@tunarr/types/jellyfin';
import { MediaSourceId } from '@tunarr/types/schemas';
import {
  every,
  flatMap,
  isEmpty,
  isNil,
  isUndefined,
  omitBy,
  sumBy,
} from 'lodash-es';
import { useEffect } from 'react';
import { useApiQuery } from '../useApiQuery.ts';
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
  const key = [
    'jellyfin',
    mediaSourceId,
    'library_items',
    parentId,
    pageParams,
  ];
  const result = useApiQuery({
    queryKey: key,
    queryFn: (apiClient) =>
      apiClient.getJellyfinItems({
        params: { mediaSourceId, libraryId: parentId },
        queries: {
          offset: pageParams?.offset,
          limit: pageParams?.limit,
          itemTypes: isEmpty(itemTypes) ? undefined : itemTypes,
        },
      }),
    enabled: enabled && every([mediaSourceId, parentId], isNonEmptyString),
  });

  useEffect(() => {
    if (!isUndefined(result.data)) {
      addKnownMediaForJellyfinServer(
        mediaSourceId,
        result.data.Items,
        parentId,
      );
    }
  }, [mediaSourceId, parentId, result.data]);

  return { ...result, queryKey: key };
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
  const key = [
    'jellyfin',
    mediaSourceId,
    'library_items',
    parentId,
    'infinite',
    { itemTypes, additionalFilters },
  ];

  const lastFetchSize = initialChunkSize + bufferSize;

  const result = useInfiniteQuery({
    queryKey: key,
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
  });

  useEffect(() => {
    if (!isUndefined(result.data)) {
      const allItems = flatMap(result.data.pages, (page) => page.Items);
      addKnownMediaForJellyfinServer(mediaSourceId, allItems, parentId);
    }
  }, [parentId, mediaSourceId, result.data]);

  return { ...result, queryKey: key };
};
