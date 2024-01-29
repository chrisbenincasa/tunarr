import { useQueries, useQuery } from '@tanstack/react-query';
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
} from '@tunarr/types/plex';
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

declare const plexQueryArgsSymbol: unique symbol;

type PlexQueryArgs<T> = {
  serverName: string;
  path: string;
  enabled: boolean;
  [plexQueryArgsSymbol]?: T;
};

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

export const usePlexTyped2 = <T = unknown, U = unknown>(
  args: [PlexQueryArgs<T>, PlexQueryArgs<U>],
) =>
  useQueries({
    queries: args.map((query) => ({
      queryKey: ['plex', query.serverName, query.path],
      queryFn: fetchPlexPath<(typeof query)[typeof plexQueryArgsSymbol]>(
        query.serverName,
        query.path,
      ),
      enabled: query.enabled,
    })),
    combine: ([firstResult, secondResult]) => {
      return {
        first: firstResult.data as T | undefined,
        second: secondResult.data as U | undefined,
        isPending: firstResult.isPending || secondResult.isPending,
        error: firstResult.error || secondResult.error,
      };
    },
  });

export type PlexMediaWithServerName = PlexTerminalMedia & {
  serverName: string;
};

export const enumeratePlexItem = (
  serverName: string,
  initialItem: PlexMedia | PlexLibrarySection,
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
          return sequentialPromises(result.Metadata, loopInner);
        })
        .then((allResults) => flattenDeep(allResults));
    }
  }

  return async function () {
    const res = await loopInner(initialItem);
    const externalIds = res.map((m) => `plex|${serverName}|${m.key}`);

    console.log(externalIds);

    await apiClient
      .batchGetProgramsByExternalIds({ externalIds })
      .then((r) => console.log(r))
      .catch((e) => console.error(e));
    return res;
  };
};
