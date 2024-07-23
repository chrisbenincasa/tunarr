import { isNonEmptyString } from '@/helpers/util.ts';
import { useApiQuery } from '../useApiQuery.ts';
import { every } from 'lodash-es';

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
  mediaSourceId: string,
  libraryId: string,
  pageParams: { offset: number; limit: number } | null = null,
  enabled: boolean = true,
) => {
  const key = [
    'jellyfin',
    mediaSourceId,
    'library_items',
    libraryId,
    pageParams,
  ];
  const result = useApiQuery({
    queryKey: key,
    queryFn: (apiClient) =>
      apiClient.getJellyfinLibraryMovies({
        params: { mediaSourceId, libraryId },
        queries: {
          offset: pageParams?.offset,
          limit: pageParams?.limit,
        },
      }),
    enabled: enabled && every([mediaSourceId, libraryId], isNonEmptyString),
  });
  return { ...result, queryKey: key };
};
