import { useQueries, useQuery } from '@tanstack/react-query';
import { PlexLibrarySections } from '@tunarr/types/plex';
import { MediaSourceId } from '@tunarr/types/schemas';
import { identity, reject } from 'lodash-es';
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
  serverId: MediaSourceId;
  path: string;
  enabled: boolean;
  [plexQueryArgsSymbol]?: T;
};

export const usePlex = <
  T extends ExtractTypeKeys<PlexPathMappings>,
  ResponseType = FindChild<T, PlexPathMappings>,
  OutType = ResponseType,
>(
  serverId: MediaSourceId,
  path: string,
  enabled: boolean = true,
  select: (response: ResponseType) => OutType = identity,
) => {
  return useApiQuery({
    queryKey: ['plex', serverId, path],
    queryFn: (apiClient) =>
      fetchPlexPath<ResponseType>(apiClient, serverId, path)(),
    enabled,
    select,
  });
};
export const usePlexTyped = <T, OutType = T>(
  serverId: MediaSourceId,
  path: string,
  enabled: boolean = true,
  select: (response: T) => OutType = identity,
) => {
  const apiClient = useTunarrApi();
  return useQuery({
    ...plexQueryOptions<T>(apiClient, serverId, path, enabled),
    select,
  });
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
      queryKey: ['plex', query.serverId, query.path],
      queryFn: fetchPlexPath<(typeof query)[typeof plexQueryArgsSymbol]>(
        apiClient,
        query.serverId,
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
export const usePlexLibraries = (
  serverId: MediaSourceId,
  enabled: boolean = true,
) =>
  usePlex<'/library/sections'>(
    serverId,
    '/library/sections',
    enabled,
    (response) => ({
      ...response,
      Directory: reject(response.Directory, { type: 'photo' }),
    }),
  );
