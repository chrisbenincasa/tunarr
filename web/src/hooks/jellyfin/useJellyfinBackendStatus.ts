import { isNonEmptyString, isValidUrl } from '@/helpers/util';
import { useQuery } from '@tanstack/react-query';
import type { JellyfinServerSettings } from '@tunarr/types';
import type { MarkOptional } from 'ts-essentials';
import { postApiMediaSourcesForeignstatusOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { Jellyfin } from '../../helpers/constants.ts';

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
  return useQuery({
    ...postApiMediaSourcesForeignstatusOptions({
      body: {
        accessToken,
        type: Jellyfin,
        uri,
        username,
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
};
