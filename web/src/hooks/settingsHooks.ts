import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import {
  getApiChannelsByIdTranscodeConfigOptions,
  getApiFfmpegSettingsOptions,
  getApiHdhrSettingsOptions,
  getApiMediaSourcesOptions,
  getApiPlexSettingsOptions,
  getApiTranscodeConfigsByIdOptions,
  getApiTranscodeConfigsOptions,
  getApiXmltvSettingsOptions,
} from '../generated/@tanstack/react-query.gen.ts';
import {
  getApiMediaSources,
  getApiPlexSettings,
} from '../generated/sdk.gen.ts';

export const useXmlTvSettings = () =>
  useSuspenseQuery(getApiXmltvSettingsOptions());

export const useFfmpegSettings = () =>
  useSuspenseQuery(getApiFfmpegSettingsOptions());

export const useMediaSources = () =>
  useSuspenseQuery(getApiMediaSourcesOptions());

export const usePlexStreamSettings = () =>
  useSuspenseQuery(getApiPlexSettingsOptions());

export const usePlexSettings = () => {
  return useQueries({
    queries: [
      {
        queryKey: ['settings', 'media-sources'],
        queryFn: () => getApiMediaSources(),
      },
      {
        queryKey: ['settings', 'plex-stream'],
        queryFn: () => getApiPlexSettings(),
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

export const useHdhrSettings = () => {
  return useSuspenseQuery({
    ...getApiHdhrSettingsOptions(),
  });
};

export const transcodeConfigsQueryOptions = () =>
  getApiTranscodeConfigsOptions();

export const useTranscodeConfigs = () => {
  return useSuspenseQuery(transcodeConfigsQueryOptions());
};

export const useTranscodeConfig = (id: string) =>
  useSuspenseQuery({
    ...getApiTranscodeConfigsByIdOptions({ path: { id } }),
  });

export const useChannelTranscodeConfig = (channelId: string) =>
  useSuspenseQuery({
    ...getApiChannelsByIdTranscodeConfigOptions({ path: { id: channelId } }),
  });
