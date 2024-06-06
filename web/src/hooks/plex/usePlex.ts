import { useQueries, useQuery } from '@tanstack/react-query';
import { PlexLibrarySections } from '@tunarr/types/plex';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import { ExtractTypeKeys, FindChild } from '../../types/util.ts';
import { useApiQuery } from '../useApiQuery.ts';
import { useTunarrApi } from '../useTunarrApi.ts';
import { plexQueryOptions } from './plexHookUtil.ts';

export type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
];

declare const plexQueryArgsSymbol: unique symbol;

type PlexQueryArgs<T> = {
  serverName: string;
  path: string;
  enabled: boolean;
  [plexQueryArgsSymbol]?: T;
};

export const usePlex = <
  T extends ExtractTypeKeys<PlexPathMappings>,
  OutType = FindChild<T, PlexPathMappings>,
>(
  serverName: string,
  path: string,
  enabled: boolean = true,
) =>
  useApiQuery({
    queryKey: ['plex', serverName, path],
    queryFn: (apiClient) =>
      fetchPlexPath<OutType>(apiClient, serverName, path)(),
    enabled,
  });
export const usePlexTyped = <T>(
  serverName: string,
  path: string,
  enabled: boolean = true,
) => {
  const apiClient = useTunarrApi();
  return useQuery(plexQueryOptions<T>(apiClient, serverName, path, enabled));
}; /**
 * Like {@link usePlexTyped} but accepts two queries that each return
 * a typed Plex object. NOTE - uses casting and not schema validation!!
 */

export const usePlexTyped2 = <T = unknown, U = unknown>(
  args: [PlexQueryArgs<T>, PlexQueryArgs<U>],
) => {
  const apiClient = useTunarrApi();
  return useQueries({
    queries: args.map((query) => ({
      queryKey: ['plex', query.serverName, query.path],
      queryFn: fetchPlexPath<(typeof query)[typeof plexQueryArgsSymbol]>(
        apiClient,
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
};
export const usePlexLibraries = (serverName: string, enabled: boolean = true) =>
  usePlex<'/library/sections'>(serverName, '/library/sections', enabled);
