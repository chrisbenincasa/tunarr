import { isNonEmptyString, isValidUrl } from '@/helpers/util';
import type { MediaSourceSettings } from '@tunarr/types';
import type { MarkOptional } from 'ts-essentials';
import { useApiQuery } from '../useApiQuery';

export const useMediaSourceBackendStatus = (
  {
    type,
    id,
    uri,
    accessToken,
  }: MarkOptional<
    Pick<MediaSourceSettings, 'id' | 'type' | 'accessToken' | 'uri'>,
    'id'
  >,
  enabled: boolean = true,
) => {
  const serverStatusResult = useApiQuery({
    queryKey: ['media-sources', { id, uri, accessToken, type }, 'status'],
    queryFn(apiClient) {
      return apiClient.getMediaSourceStatus({ params: { id: id! } });
    },
    enabled: enabled && isNonEmptyString(id),
    retry: false,
    staleTime: 0,
  });

  const unknownServerStatusResult = useApiQuery({
    queryKey: [
      'unknown-media-source',
      { type, id, uri, accessToken },
      'status',
    ],
    queryFn(apiClient) {
      return apiClient.getUnknownMediaSourceStatus({
        uri,
        accessToken,
        type,
      });
    },
    enabled:
      enabled &&
      !isNonEmptyString(id) &&
      isNonEmptyString(uri) &&
      isValidUrl(uri) &&
      isNonEmptyString(accessToken),
    retry: false,
    staleTime: 0,
  });

  return isNonEmptyString(id) ? serverStatusResult : unknownServerStatusResult;
};
