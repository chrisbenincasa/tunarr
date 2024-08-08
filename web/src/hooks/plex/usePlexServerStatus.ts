import { useQuery } from '@tanstack/react-query';
import { DefaultPlexHeaders } from '@tunarr/shared/constants';
import { MediaSourceSettings } from '@tunarr/types';
import axios from 'axios';

export const useMediaSourceStatus = ({
  type,
  uri,
  accessToken,
}: Pick<MediaSourceSettings, 'type' | 'uri' | 'accessToken'>) => {
  return useQuery({
    queryKey: ['media-sources', { type, uri, accessToken }, 'status-local'],
    queryFn: async () => {
      try {
        await axios.get(`${uri}`, {
          headers: {
            ...DefaultPlexHeaders,
            'X-Plex-Token': accessToken,
          },
          timeout: 30 * 1000,
        });
        return true;
      } catch (e) {
        console.error('Error querying Plex from frontend', e);
        return false;
      }
    },
  });
};
