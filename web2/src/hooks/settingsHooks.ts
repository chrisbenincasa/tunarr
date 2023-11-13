import { useQuery } from '@tanstack/react-query';
import { FfmpegSettings, XmlTvSettings } from 'dizquetv-types';

const useSettings = <T>(settings: string, path: string) =>
  useQuery({
    queryKey: ['settings', settings],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/api/' + path);
      return res.json() as Promise<T>;
    },
  });

export const useXmlTvSettings = () =>
  useSettings<XmlTvSettings>('xmltv', 'xmltv-settings');

export const useFfmpegSettings = () =>
  useSettings<FfmpegSettings>('ffmpeg', 'ffmpeg-settings');
