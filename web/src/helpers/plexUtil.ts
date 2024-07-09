import { MediaSourceId } from '@tunarr/types/schemas';
import { ApiClient } from '../external/api.ts';

export const fetchPlexPath = <T>(
  apiClient: ApiClient,
  serverId: MediaSourceId,
  path: string,
) => {
  return async () => {
    return apiClient
      .getPlexPath({
        queries: {
          id: serverId,
          path,
        },
      })
      .then((r) => r as T);
  };
};
