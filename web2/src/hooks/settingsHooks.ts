import { useQueries, useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';

export const useXmlTvSettings = () =>
  useQuery({
    queryKey: ['settings', 'xmltv'],
    queryFn: () => apiClient.getXmlTvSettings(),
  });

export const useFfmpegSettings = () =>
  useQuery({
    queryKey: ['settings', 'ffmpeg'],
    queryFn: () => apiClient.getFfmpegSettings(),
  });

export const usePlexServerSettings = () =>
  useQuery({
    queryKey: ['settings', 'plex-servers'],
    queryFn: () => apiClient.getPlexServers(),
  });

export const usePlexStreamSettings = () =>
  useQuery({
    queryKey: ['settings', 'plex-stream'],
    queryFn: () => apiClient.getPlexStreamSettings(),
  });

export const usePlexSettings = () =>
  useQueries({
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

export const useHdhrSettings = () =>
  useQuery({
    queryKey: ['settings', 'hdhr'],
    queryFn: () => apiClient.getHdhrSettings(),
  });
