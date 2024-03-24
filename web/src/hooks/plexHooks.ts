import { useQueries, useQuery } from '@tanstack/react-query';
import { DefaultPlexHeaders } from '@tunarr/shared/constants';
import { PlexServerSettings } from '@tunarr/types';
import {
  PlexEpisodeView,
  PlexFiltersResponse,
  PlexLibraryListing,
  PlexLibrarySection,
  PlexLibrarySections,
  PlexMedia,
  PlexSeasonView,
  PlexTagResult,
  PlexTerminalMedia,
  isPlexDirectory,
  isTerminalItem,
} from '@tunarr/types/plex';
import axios from 'axios';
import { flattenDeep, map } from 'lodash-es';
import { useEffect } from 'react';
import { apiClient } from '../external/api.ts';
import { sequentialPromises } from '../helpers/util.ts';
import useStore from '../store/index.ts';
import { setPlexMetadataFilters } from '../store/plexMetadata/actions.ts';

type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
];

type FindChild0<Target, Arr extends unknown[] = []> = Arr extends [
  [infer Head, infer Child],
  ...infer Tail,
]
  ? Head extends Target
    ? Child
    : FindChild0<Target, Tail>
  : never;

// Turns a key/val tuple type array into a union of the "keys"
type ExtractTypeKeys<
  Arr extends unknown[] = [],
  Acc extends unknown[] = [],
> = Arr extends []
  ? Acc
  : Arr extends [[infer Head, any], ...infer Tail]
  ? Head | ExtractTypeKeys<Tail>
  : never;

export const fetchPlexPath = <T>(serverName: string, path: string) => {
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

export const usePlex = <
  T extends ExtractTypeKeys<PlexPathMappings>,
  OutType = FindChild0<T, PlexPathMappings>,
>(
  serverName: string,
  path: string,
  enabled: boolean = true,
) =>
  useQuery({
    queryKey: ['plex', serverName, path],
    queryFn: fetchPlexPath<OutType>(serverName, path),
    enabled,
  });

export const usePlexLibraries = (serverName: string, enabled: boolean = true) =>
  usePlex<'/library/sections'>(serverName, '/library/sections', enabled);

declare const plexQueryArgsSymbol: unique symbol;

type PlexQueryArgs<T> = {
  serverName: string;
  path: string;
  enabled: boolean;
  [plexQueryArgsSymbol]?: T;
};

export const plexQueryOptions = <T>(
  serverName: string,
  path: string,
  enabled: boolean = true,
) => ({
  queryKey: ['plex', serverName, path],
  queryFn: fetchPlexPath<T>(serverName, path),
  enabled: enabled && serverName.length > 0 && path.length > 0,
});

export const usePlexTyped = <T>(
  serverName: string,
  path: string,
  enabled: boolean = true,
) => useQuery(plexQueryOptions<T>(serverName, path, enabled));

/**
 * Like {@link usePlexTyped} but accepts two queries that each return
 * a well-typed Plex object
 */
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

export const usePlexServerStatus = (server: PlexServerSettings) => {
  return useQuery({
    queryKey: ['plex-servers', server.id, 'status-local'],
    queryFn: async () => {
      try {
        await axios.get(`${server.uri}`, {
          headers: {
            ...DefaultPlexHeaders,
            'X-Plex-Token': server.accessToken,
          },
          timeout: 30 * 1000,
        });
        return true;
      } catch (e) {
        return false;
      }
    },
  });
};

export const usePlexFilters = (serverName: string, plexKey: string) => {
  const key = `/library/sections/${plexKey}/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0`;
  const query = useQuery<PlexFiltersResponse>({
    ...plexQueryOptions(
      serverName,
      key,
      serverName.length > 0 && plexKey.length > 0,
    ),
    staleTime: 1000 * 60 * 60 * 60,
  });

  useEffect(() => {
    if (query.data) {
      setPlexMetadataFilters(serverName, plexKey, query.data);
    }
  }, [serverName, plexKey, query.data]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    data: useStore(({ plexMetadata }) => {
      const server = plexMetadata.libraryFilters[serverName];
      if (server) {
        return server[plexKey]?.Meta;
      }
    }),
  };
};

export const usePlexTags = (key: string) => {
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );
  const path = selectedLibrary
    ? `/library/sections/${selectedLibrary.library.key}/${key}`
    : '';

  return useQuery<PlexTagResult>({
    ...plexQueryOptions(selectedServer?.name ?? '', path),
  });
};

export type EnrichedPlexMedia = PlexTerminalMedia & {
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
};

function plexItemExternalId(serverName: string, media: PlexTerminalMedia) {
  return `plex|${serverName}|${media.key}`;
}

export const enumeratePlexItem = (
  serverName: string,
  initialItem: PlexMedia | PlexLibrarySection,
): (() => Promise<EnrichedPlexMedia[]>) => {
  const fetchPlexPathFunc = <T>(path: string) =>
    fetchPlexPath<T>(serverName, path)();

  async function loopInner(
    item: PlexMedia | PlexLibrarySection,
  ): Promise<EnrichedPlexMedia[]> {
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
    const externalIds = res.map((m) => plexItemExternalId(serverName, m));

    // This is best effort - if the user saves these IDs later, the upsert
    // logic should figure out what is new/existing
    try {
      const existingIdsByExternalId =
        await apiClient.batchGetProgramsByExternalIds({ externalIds });
      return map(res, (media) => ({
        ...media,
        id: existingIdsByExternalId[plexItemExternalId(serverName, media)]?.id,
      }));
    } catch (e) {
      console.error('Unable to retrieve IDs in batch', e);
    }

    return res;
  };
};

export const usePlexSearch = () => {};
