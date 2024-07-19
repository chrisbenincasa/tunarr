import { isNonEmptyString, isValidUrl } from '@/helpers/util';
import { JellyfinServerSettings } from '@tunarr/types';
import { MarkOptional } from 'ts-essentials';
import { useApiQuery } from '../useApiQuery';

export const useJellyfinBackendStatus = (
  {
    id,
    uri,
    accessToken,
    username,
  }: MarkOptional<
    Pick<JellyfinServerSettings, 'id' | 'accessToken' | 'uri'> & {
      username?: string;
    },
    'id'
  >,
  enabled: boolean = true,
) => {
  // const serverStatusResult = useApiQuery({
  //   queryKey: ['plex-server', { id, uri, accessToken }, 'status'],
  //   queryFn(apiClient) {
  //     return apiClient.getPlexServerStatus({ params: { id: id! } });
  //   },
  //   enabled: enabled && isNonEmptyString(id),
  //   retry: false,
  //   staleTime: 0,
  // });

  console.log(id, uri, accessToken, username);

  const unknownServerStatusResult = useApiQuery({
    queryKey: ['unknown-jellyfin-server', { id, uri, accessToken }, 'status'],
    queryFn(apiClient) {
      return apiClient.getUnknownPlexServerStatus({
        uri,
        accessToken,
        username,
        type: 'jellyfin',
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

  return unknownServerStatusResult;
};
