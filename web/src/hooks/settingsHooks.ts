import { useQueries } from '@tanstack/react-query';
import { useApiQuery } from './useApiQuery.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const useXmlTvSettings = () =>
  useApiQuery({
    queryKey: ['settings', 'xmltv'],
    queryFn: (apiClient) => apiClient.getXmlTvSettings(),
  });

export const useFfmpegSettings = () =>
  useApiQuery({
    queryKey: ['settings', 'ffmpeg'],
    queryFn: (apiClient) => apiClient.getFfmpegSettings(),
  });

export const usePlexServerSettings = () =>
  useApiQuery({
    queryKey: ['settings', 'plex-servers'],
    queryFn: (apiClient) => apiClient.getPlexServers(),
  });

export const usePlexStreamSettings = () =>
  useApiQuery({
    queryKey: ['settings', 'plex-stream'],
    queryFn: (apiClient) => apiClient.getPlexStreamSettings(),
  });

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
  useApiQuery({
    queryKey: ['settings', 'hdhr'],
    queryFn: (apiClient) => apiClient.getHdhrSettings(),
  });
