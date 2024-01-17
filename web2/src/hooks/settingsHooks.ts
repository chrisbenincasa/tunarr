import { useQueries, useQuery } from '@tanstack/react-query';
import {
  FfmpegSettings,
  PlexServerSettings,
  PlexStreamSettings,
  XmlTvSettings,
  HdhrSettings,
} from 'dizquetv-types';

const getQuerySettings = <T>(settings: string, path: string) => ({
  queryKey: ['settings', settings],
  queryFn: async () => {
    const res = await fetch('http://localhost:8000/api/' + path);
    return res.json() as Promise<T>;
  },
});

const useSettings = <T>(settings: string, path: string) =>
  useQuery(getQuerySettings<T>(settings, path));

export const useXmlTvSettings = () =>
  useSettings<XmlTvSettings>('xmltv', 'xmltv-settings');

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
