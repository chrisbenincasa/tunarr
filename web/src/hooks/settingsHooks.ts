import type { ApiClient } from '@/external/api.ts';
import type { DataTag } from '@tanstack/react-query';
import {
  queryOptions,
  useQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { MediaSourceSettings } from '@tunarr/types';
import { apiQueryOptions, useApiSuspenseQuery } from './useApiQuery.ts';
import { useTunarrApi } from './useTunarrApi.ts';

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

export const MediaSourcesQueryKey = ['settings', 'media-sources'] as DataTag<
  ['settings', 'media-sources'],
  MediaSourceSettings[]
>;

export const useMediaSources = () =>
  useApiSuspenseQuery({
    queryKey: MediaSourcesQueryKey,
    queryFn: (apiClient) => apiClient.getMediaSources(),
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
        queryKey: MediaSourcesQueryKey,
        queryFn: () => apiClient.getMediaSources(),
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

export const transcodeConfigsQueryOptions = (apiClient: ApiClient) =>
  queryOptions({
    queryKey: ['settings', 'transcode_configs'],
    queryFn: () => apiClient.getTranscodeConfigs(),
  });

export const useTranscodeConfigs = () => {
  const apiClient = useTunarrApi();
  return useSuspenseQuery(transcodeConfigsQueryOptions(apiClient));
};

function fetchTranscodeConfigFunc(apiClient: ApiClient) {
  return (id: string) => {
    return apiClient.getTranscodeConfig({ params: { id } });
  };
}

export const transcodeConfigQueryOptions = (api: ApiClient, id: string) =>
  queryOptions({
    queryKey: ['settings', 'transcode_configs', id],
    queryFn: () => fetchTranscodeConfigFunc(api)(id),
  });

export const useTranscodeConfig = (id: string) =>
  useApiSuspenseQuery({
    queryKey: ['settings', 'transcode_configs', id],
    queryFn: (apiClient) => fetchTranscodeConfigFunc(apiClient)(id),
  });

export const useChannelTranscodeConfig = (channelId: string) =>
  useApiSuspenseQuery({
    queryKey: ['channels', channelId, 'transcode_config'],
    queryFn: (apiClient) =>
      apiClient.getChannelTranscodeConfig({
        params: {
          id: channelId,
        },
      }),
  });
