import { UseQueryOptions, useQueries, useQuery } from '@tanstack/react-query';
import {
  FfmpegSettings,
  HdhrSettings,
  PlexServerSettings,
  PlexStreamSettings,
  XmlTvSettings,
} from '@tunarr/types';
import { apiClient } from '../external/api.ts';
import {
  ApiAliases,
  RequestMethodForAlias,
  ZodiosAliasReturnType,
} from '../types/index.ts';

// function getQuerySettings<Path extends ApiAliases>(
//   settings: string,
//   method: Path,
//   params: Parameters<RequestMethodForAlias<Path>>,
// ): UseQueryOptions<ZodiosAliasReturnType<Path>> {
//   return {
//     queryKey: ['settings', settings],
//     queryFn: () => {
//       return apiClient[method](params);
//     },
//   };
// }

export const useXmlTvSettings = () => useQuery({});

export const useFfmpegSettings = () =>
  useSettings<FfmpegSettings>('ffmpeg', 'ffmpeg-settings');

export const usePlexServerSettings = () =>
  useSettings<PlexServerSettings[]>('plex-servers', 'plex-servers');

export const usePlexStreamSettings = () =>
  useSettings<PlexStreamSettings>('plex', 'plex-settings');

export const usePlexSettings = () =>
  useQueries({
    queries: [
      getQuerySettings<PlexServerSettings[]>('plex-servers', 'plex-servers'),
      getQuerySettings<PlexStreamSettings>('plex', 'plex-settings'),
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
  useSettings<HdhrSettings>('hdhr', 'hdhr-settings');
