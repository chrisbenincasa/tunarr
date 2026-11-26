import { useSuspenseQuery } from '@tanstack/react-query';
import {
  getApiChannelsByIdTranscodeConfigOptions,
  getApiFfmpegSettingsOptions,
  getApiHdhrSettingsOptions,
  getApiMediaSourcesOptions,
  getApiTranscodeConfigsByIdOptions,
  getApiTranscodeConfigsOptions,
  getApiXmltvSettingsOptions,
} from '../generated/@tanstack/react-query.gen.ts';

export const useXmlTvSettings = () =>
  useSuspenseQuery(getApiXmltvSettingsOptions());

export const useFfmpegSettings = () =>
  useSuspenseQuery(getApiFfmpegSettingsOptions());

export const useMediaSources = () =>
  useSuspenseQuery(getApiMediaSourcesOptions());

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
