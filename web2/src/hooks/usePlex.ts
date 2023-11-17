import { useQuery } from '@tanstack/react-query';
import { PlexLibrarySections } from 'dizquetv-types/plex';

type PlexPathMappings = {
  '/library/sections': PlexLibrarySections;
};

export const usePlex = <T extends keyof PlexPathMappings>(
  serverName: string,
  path: T,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['plex', serverName, path],
    queryFn: async () => {
      const res = await fetch(
        `http://localhost:8000/api/plex?name=${serverName}&path=${path}`,
      );
      return res.json() as Promise<PlexPathMappings[T]>;
    },
    enabled,
  });
