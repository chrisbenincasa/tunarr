import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import {
  getChannelTranscodeConfigOptions,
  getFfmpegSettingsOptions,
  getHdhrSettingsOptions,
  getMediaSourcesOptions,
  getPlexStreamSettingsOptions,
  getTranscodeConfigByIdOptions,
  getTranscodeConfigsOptions,
  getXmltvSettingsOptions,
} from '../generated/@tanstack/react-query.gen.ts';
import {
  getMediaSources,
  getPlexStreamSettings,
} from '../generated/sdk.gen.ts';

export const useXmlTvSettings = () =>
  useSuspenseQuery(getXmltvSettingsOptions());

export const useFfmpegSettings = () =>
  useSuspenseQuery(getFfmpegSettingsOptions());

export const useMediaSources = () =>
  useSuspenseQuery(getMediaSourcesOptions());

export const usePlexStreamSettings = () =>
  useSuspenseQuery(getPlexStreamSettingsOptions());

export const usePlexSettings = () => {
  return useQueries({
    queries: [
      {
        queryKey: ['settings', 'media-sources'],
        queryFn: () => getMediaSources(),
      },
      {
        queryKey: ['settings', 'plex-stream'],
        queryFn: () => getPlexStreamSettings(),
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
    ...getHdhrSettingsOptions(),
  });
};

export const transcodeConfigsQueryOptions = () =>
  getTranscodeConfigsOptions();

export const useTranscodeConfigs = () => {
  return useSuspenseQuery(transcodeConfigsQueryOptions());
};

export const useTranscodeConfig = (id: string) =>
  useSuspenseQuery({
    ...getTranscodeConfigByIdOptions({ path: { id } }),
  });

export const useChannelTranscodeConfig = (channelId: string) =>
  useSuspenseQuery({
    ...getChannelTranscodeConfigOptions({ path: { id: channelId } }),
  });
