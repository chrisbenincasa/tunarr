import type { UseQueryOptions } from '@tanstack/react-query';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { PlexLibrarySections, PlexPlaylists } from '@tunarr/types/plex';
import { identity, reject } from 'lodash-es';
import type { queryPlexQueryKey } from '../../generated/@tanstack/react-query.gen.ts';
import { queryPlexOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { queryPlex } from '../../generated/sdk.gen.ts';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import type { ExtractTypeKeys, FindChild } from '../../types/util.ts';
import { plexQueryOptions } from './plexHookUtil.ts';

export type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
  ['/playlists', PlexPlaylists],
];

declare const plexQueryArgsSymbol: unique symbol;

type PlexQueryArgs<T> = {
  serverId: string;
  path: string;
  enabled: boolean;
  [plexQueryArgsSymbol]?: T;
};

export const usePlex = <
  T extends ExtractTypeKeys<PlexPathMappings>,
  ResponseType = FindChild<T, PlexPathMappings>,
  OutType = ResponseType,
>(
  serverId: string,
  path: string,
  enabled: boolean = true,
  select: (response: ResponseType) => OutType = identity,
) => {
  return useQuery({
    ...queryPlexOptions({
      query: {
        id: serverId,
        path,
      },
    }),
    queryFn: async () => {
      const result = await queryPlex({
        query: { id: serverId, path },
        throwOnError: true,
      });
      return result.data as ResponseType;
    },
    enabled,
    select,
  } as UseQueryOptions<
    ResponseType,
    Error,
    OutType,
    ReturnType<typeof queryPlexQueryKey>
  >);
};

export const usePlexTyped = <T, OutType = T>(
  serverId: string,
  path: string,
  enabled: boolean = true,
  select: (response: T) => OutType = identity,
) => {
  return useQuery({
    ...plexQueryOptions<T>(serverId, path, enabled),
    select,
  });
};

/**
 * Like {@link usePlexTyped} but accepts two queries that each return
 * a typed Plex object. NOTE - uses casting and not schema validation!!
 */
export const usePlexTyped2 = <T = unknown, U = unknown>(
  args: [PlexQueryArgs<T>, PlexQueryArgs<U>],
) => {
  return useQueries({
    queries: args.map((query) => ({
      queryKey: ['plex', query.serverId, query.path],
      queryFn: fetchPlexPath<(typeof query)[typeof plexQueryArgsSymbol]>(
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

export const usePlexLibraries = (serverId: string, enabled: boolean = true) =>
  usePlex<'/library/sections'>(
    serverId,
    '/library/sections',
    enabled,
    (response) => ({
      ...response,
      Directory: reject(response.Directory, { type: 'photo' }),
    }),
  );

export const usePlexPlaylists = (serverId: string, enabled: boolean = true) =>
  usePlexTyped<PlexPlaylists>(serverId, '/playlists', enabled);
