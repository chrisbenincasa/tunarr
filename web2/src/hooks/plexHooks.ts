import { useQuery } from '@tanstack/react-query';
import {
  PlexEpisode,
  PlexEpisodeView,
  PlexLibraryListing,
  PlexLibrarySection,
  PlexLibrarySections,
  PlexMedia,
  PlexMovie,
  PlexSeasonView,
  isPlexDirectory,
  isTerminalItem,
} from 'dizquetv-types/plex';
import { flattenDeep } from 'lodash-es';
import { apiClient } from '../external/api.ts';
import { sequentialPromises } from '../helpers/util.ts';
import { addKnownMediaForServer } from '../store/programmingSelector/actions.ts';

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

export const enumeratePlexItem = <T extends PlexMedia | PlexLibrarySection>(
  serverName: string,
  initialItem: T,
): (() => Promise<(PlexMovie | PlexEpisode)[]>) => {
  // const queryClient = useQueryClient();
  const fetchPlexPathFunc = <T>(path: string) =>
    fetchPlexPath<T>(serverName, path)();

  async function loopInner(
    item: PlexMedia | PlexLibrarySection,
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
        .then(async (result) => {
          const externalIds = result.Metadata.map(
            (m) => `plex|${serverName}|${m.ratingKey}`,
          );
          const res = await apiClient.batchGetProgramsByExternalIds({
            externalIds,
          });
          console.log(res);
          return sequentialPromises(result.Metadata, loopInner);
        })
        .then((allResults) => flattenDeep(allResults));
    }
  }

  return function () {
    return loopInner(initialItem);
  };
};
