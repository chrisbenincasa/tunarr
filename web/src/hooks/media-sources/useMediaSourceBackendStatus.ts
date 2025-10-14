import { isNonEmptyString, isValidUrl } from '@/helpers/util';
import { useQuery } from '@tanstack/react-query';
import type { RemoteMediaSourceSettings } from '@tunarr/types';
import type { MarkOptional } from 'ts-essentials';
import {
  getApiMediaSourcesByIdStatusOptions,
  postApiMediaSourcesForeignstatusOptions,
} from '../../generated/@tanstack/react-query.gen.ts';

export const useMediaSourceBackendStatus = (
  {
    type,
    id,
    uri,
    accessToken,
  }: MarkOptional<
    Pick<RemoteMediaSourceSettings, 'id' | 'type' | 'accessToken' | 'uri'>,
    'id'
  >,
  enabled: boolean = true,
) => {
  const serverStatusResult = useQuery({
    ...getApiMediaSourcesByIdStatusOptions({
      path: {
        id: id!,
      },
    }),
    enabled: enabled && isNonEmptyString(id),
    retry: false,
    staleTime: 0,
  });

  const unknownServerStatusResult = useQuery({
    ...postApiMediaSourcesForeignstatusOptions({
      body: {
        accessToken,
        type,
        uri,
      },
    }),
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
