import { useApiQuery } from './useApiQuery.ts';

export const useFfmpegInfo = (enabled: boolean = true) =>
  useApiQuery({
    queryKey: ['ffmpeg-info'],
    queryFn: (apiClient) => apiClient.getFfmpegInfo(),
    enabled,
  });
