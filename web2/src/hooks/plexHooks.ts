import { useQuery } from '@tanstack/react-query';
import {
  PlexEpisode,
  PlexEpisodeView,
  PlexLibraryListing,
  PlexLibraryMovies,
  PlexLibrarySections,
  PlexLibraryShows,
  PlexMedia,
  PlexMovie,
  PlexSeasonView,
  isPlexDirectory,
  isPlexSeason,
  isPlexShow,
  isTerminalItem,
} from 'dizquetv-types/plex';
import { flattenDeep } from 'lodash-es';
import { sequentialPromises } from '../helpers/util.ts';

type PlexPathMappings = {
  '/library/sections': PlexLibrarySections;
};

const fetchPlexPath = <T>(serverName: string, path: string) => {
  return async () => {
    const res = await fetch(
      `http://localhost:8000/api/plex?name=${serverName}&path=${path}`,
    );
    return res.json() as Promise<T>;
  };
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

export const usePlexTyped = <T>(
  serverName: string,
  path: string,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['plex', serverName, path],
    queryFn: fetchPlexPath<T>(serverName, path),
    enabled,
  });

export const enumeratePlexItem = <T extends PlexMedia>(
  serverName: string,
  initialItem: T,
): (() => Promise<(PlexMovie | PlexEpisode)[]>) => {
  // const queryClient = useQueryClient();
  const fetchPlexPathFunc = <T>(path: string) =>
    fetchPlexPath<T>(serverName, path)();

  async function loopInner(
    item: PlexMedia,
  ): Promise<(PlexMovie | PlexEpisode)[]> {
    if (isTerminalItem(item)) {
      return [item];
    } else {
      const path = isPlexDirectory(item)
        ? `/library/sections/${item.key}/all`
        : item.key;
      return fetchPlexPathFunc<
        PlexLibraryListing | PlexSeasonView | PlexEpisodeView
      >(path)
        .then((result) => sequentialPromises(result.Metadata, loopInner))
        .then((allResults) => flattenDeep(allResults));
    }
  }

  return function () {
    return loopInner(initialItem);
  };
};
