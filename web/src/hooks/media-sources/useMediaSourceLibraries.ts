import type { DataTag } from '@tanstack/react-query';
import type { MediaSourceLibrary } from '@tunarr/types';
import type { MediaSourceId } from '@tunarr/types/schemas';
import { useApiQuery, useApiSuspenseQuery } from '../useApiQuery.ts';

export const MediaSourceLibrariesQueryKey = (mediaSourceId: MediaSourceId) =>
  ['media-sources', mediaSourceId, 'libraries'] as DataTag<
    ['media-sources', MediaSourceId, 'libraries'],
    MediaSourceLibrary[]
  >;

export const useMediaSourceLibraries = (
  mediaSourceId: MediaSourceId,
  enabled: boolean = true,
) =>
  useApiQuery({
    queryFn: (apiClient) =>
      apiClient.getMediaLibraries({ params: { mediaSourceId } }),
    queryKey: MediaSourceLibrariesQueryKey(mediaSourceId),
    enabled,
    staleTime: 60 * 1000,
  });

export const useMediaSourceLibrariesSuspense = (mediaSourceId: MediaSourceId) =>
  useApiSuspenseQuery({
    queryFn: (apiClient) =>
      apiClient.getMediaLibraries({ params: { mediaSourceId } }),
    queryKey: MediaSourceLibrariesQueryKey(mediaSourceId),
    staleTime: 60 * 1000,
  });
