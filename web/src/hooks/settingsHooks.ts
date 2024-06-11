import { queryOptions, useQueries } from '@tanstack/react-query';
import { apiQueryOptions, useApiSuspenseQuery } from './useApiQuery.ts';
import { useTunarrApi } from './useTunarrApi.ts';
import { ApiClient } from '@/external/api.ts';

export const useXmlTvSettings = () =>
  useApiSuspenseQuery({
    queryKey: ['settings', 'xmltv'],
    queryFn: (apiClient) => apiClient.getXmlTvSettings(),
  });

export const useFfmpegSettings = () =>
  useApiSuspenseQuery({
    queryKey: ['settings', 'ffmpeg'],
    queryFn: (apiClient) => apiClient.getFfmpegSettings(),
  });

export const usePlexServerSettings = () =>
  useApiSuspenseQuery({
    queryKey: ['settings', 'plex-servers'],
    queryFn: (apiClient) => apiClient.getPlexServers(),
  });

export const plexStreamSettingsQuery = apiQueryOptions({
  queryKey: ['settings', 'plex-stream'],
  queryFn: (apiClient) => apiClient.getPlexStreamSettings(),
});

export const plexStreamSettingsQueryWithApi = (apiClient: ApiClient) =>
  queryOptions({
    queryKey: ['settings', 'plex-stream'],
    queryFn: () => apiClient.getPlexStreamSettings(),
  });

export const usePlexStreamSettings = () =>
  useApiSuspenseQuery(plexStreamSettingsQuery);

export const usePlexSettings = () => {
  const apiClient = useTunarrApi();
  return useQueries({
    queries: [
      {
        queryKey: ['settings', 'plex-servers'],
        queryFn: () => apiClient.getPlexServers(),
      },
      {
        queryKey: ['settings', 'plex-stream'],
        queryFn: () => apiClient.getPlexStreamSettings(),
      },
    ],
    combine: (result) => {
      const [serversResult, streamResult] = result;
      if (serversResult.error || streamResult.error) {
        return {
          error: serversResult.error ?? streamResult.error,
          isPending: false,
        };
      }
      if (serversResult.isPending || streamResult.isPending) {
        return { isPending: true };
      }
      return {
        servers: serversResult.data,
        streamSettings: streamResult.data,
        isPending: false,
        error: undefined,
      };
    },
  });
};

export const useHdhrSettings = () =>
  useApiSuspenseQuery({
    queryKey: ['settings', 'hdhr'],
    queryFn: (apiClient) => apiClient.getHdhrSettings(),
  });
