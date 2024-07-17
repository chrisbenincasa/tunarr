import { useQuery } from '@tanstack/react-query';
import { DefaultPlexHeaders } from '@tunarr/shared/constants';
import { PlexServerSettings } from '@tunarr/types';
import axios from 'axios';

export const usePlexServerStatus = ({
  uri,
  accessToken,
}: Pick<PlexServerSettings, 'uri' | 'accessToken'>) => {
  return useQuery({
    queryKey: ['plex-servers', { uri, accessToken }, 'status-local'],
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
