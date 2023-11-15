import { useQuery } from '@tanstack/react-query';

export const useVersion = () =>
  useQuery({
    queryKey: ['version'],
    queryFn: async () => {
      const res = await fetch('http://localhost:8000/api/version');
      return res.json() as Promise<{
        dizquetv: string;
        ffmpeg: string;
        nodejs: string;
      }>; // TODO: Properly type this
    },
  });
