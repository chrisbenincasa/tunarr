import { ApiClient } from '../external/api.ts';

export const fetchPlexPath = <T>(
  apiClient: ApiClient,
  serverName: string,
  path: string,
) => {
  return async () => {
    return apiClient
      .getPlexPath({
        queries: {
          name: serverName,
          path,
        },
      })
      .then((r) => r as T);
  };
};
