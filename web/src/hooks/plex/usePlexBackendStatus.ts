import { PlexServerSettings } from '@tunarr/types';
import { MarkOptional } from 'ts-essentials';
import { useApiQuery } from '../useApiQuery';
import { isNonEmptyString, isValidUrl } from '@/helpers/util';

export const usePlexBackendStatus = (
  {
    id,
    uri,
    accessToken,
  }: MarkOptional<Pick<PlexServerSettings, 'id' | 'accessToken' | 'uri'>, 'id'>,
  enabled: boolean = true,
) => {
  const serverStatusResult = useApiQuery({
    queryKey: ['plex-server', { id, uri, accessToken }, 'status'],
    queryFn(apiClient) {
      return apiClient.getPlexServerStatus({ params: { id: id! } });
    },
    enabled: enabled && isNonEmptyString(id),
    retry: false,
    staleTime: 0,
  });

  const unknownServerStatusResult = useApiQuery({
    queryKey: ['unknown-plex-server', { id, uri, accessToken }, 'status'],
    queryFn(apiClient) {
      return apiClient.getUnknownPlexServerStatus({ uri, accessToken });
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
