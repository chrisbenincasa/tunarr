import { useQuery } from '@tanstack/react-query';
import {
  PlexEpisodeView,
  PlexLibraryListing,
  PlexLibrarySection,
  PlexLibrarySections,
  PlexMedia,
  PlexSeasonView,
  PlexTerminalMedia,
  isPlexDirectory,
  isTerminalItem,
} from 'dizquetv-types/plex';
import { flattenDeep } from 'lodash-es';
import { apiClient } from '../external/api.ts';
import { sequentialPromises } from '../helpers/util.ts';

type PlexPathMappings = {
  '/library/sections': PlexLibrarySections;
};

const fetchPlexPath = <T>(serverName: string, path: string) => {
  return async () => {
    return apiClient
      .getPlexPath({
        queries: {
          name: serverName,
          path,
        },
      })
      .then((r) => r as T);
  };
};

export const usePlex = <T extends keyof PlexPathMappings>(
  serverName: string,
  path: T,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['plex', serverName, path],
    queryFn: fetchPlexPath<PlexPathMappings[T]>(serverName, path),
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

export type PlexMediaWithServerName = PlexTerminalMedia & {
  serverName: string;
};

export const enumeratePlexItem = <T extends PlexMedia | PlexLibrarySection>(
  serverName: string,
  initialItem: T,
): (() => Promise<PlexMediaWithServerName[]>) => {
  const fetchPlexPathFunc = <T>(path: string) =>
    fetchPlexPath<T>(serverName, path)();

  async function loopInner(
    item: PlexMedia | PlexLibrarySection,
  ): Promise<PlexMediaWithServerName[]> {
    if (isTerminalItem(item)) {
      return [{ ...item, serverName }];
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

          console.log(externalIds);

          apiClient
            .batchGetProgramsByExternalIds({ externalIds })
            .then((r) => console.log(r))
            .catch((e) => console.error(e));

          return sequentialPromises(result.Metadata, loopInner);
        })
        .then((allResults) => flattenDeep(allResults));
    }
  }

  return function () {
    return loopInner(initialItem);
  };
};
