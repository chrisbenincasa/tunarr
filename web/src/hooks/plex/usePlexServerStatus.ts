import { useQuery } from '@tanstack/react-query';
import { DefaultPlexHeaders } from '@tunarr/shared/constants';
import { PlexServerSettings } from '@tunarr/types';
import axios from 'axios';

export const usePlexServerStatus = (server: PlexServerSettings) => {
  return useQuery({
    queryKey: ['plex-servers', server.id, 'status-local'],
    queryFn: async () => {
      try {
        await axios.get(`${server.uri}`, {
          headers: {
            ...DefaultPlexHeaders,
            'X-Plex-Token': server.accessToken,
          },
          timeout: 30 * 1000,
        });
        return true;
      } catch (e) {
        return false;
      }
    },
  });
};
