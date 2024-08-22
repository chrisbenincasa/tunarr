import { isNonEmptyString } from '@/helpers/util.ts';
import { useApiQuery } from '../useApiQuery.ts';
import { every, flatMap, isEmpty, isUndefined, sumBy } from 'lodash-es';
import { useTunarrApi } from '../useTunarrApi.ts';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { addKnownMediaForJellyfinServer } from '@/store/programmingSelector/actions.ts';
import { MediaSourceId } from '@tunarr/types/schemas';
import { JellyfinItemKind } from '@tunarr/types/jellyfin';

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

export const useInfiniteJellyfinLibraryItems = (
  mediaSourceId: MediaSourceId,
  parentId: string,
  itemTypes: JellyfinItemKind[],
  enabled: boolean = true,
  chunkSize: number = 20,
) => {
  const apiClient = useTunarrApi();
  const key = [
    'jellyfin',
    mediaSourceId,
    'library_items',
    parentId,
    'infinite',
  ];

  const result = useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam }) =>
      apiClient.getJellyfinItems({
        params: { mediaSourceId, libraryId: parentId },
        queries: {
          offset: pageParam,
          limit: chunkSize,
          itemTypes: isEmpty(itemTypes) ? undefined : itemTypes,
        },
      }),
    enabled: enabled && every([mediaSourceId, parentId], isNonEmptyString),
    initialPageParam: 0,
    getNextPageParam: (res, all, last) => {
      const total = sumBy(all, (page) => page.Items.length);
      if (total >= (res.TotalRecordCount ?? res.Items.length)) {
        return null;
      }

      // Next offset is the last + how many items we got back.
      return last + res.Items.length;
    },
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!isUndefined(result.data)) {
      const allItems = flatMap(result.data.pages, (page) => page.Items);
      addKnownMediaForJellyfinServer(mediaSourceId, allItems, parentId);
    }
  }, [parentId, mediaSourceId, result.data]);

  return { ...result, queryKey: key };
};
