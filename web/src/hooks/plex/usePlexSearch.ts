import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import type { DataTag } from '@tanstack/react-query';
import {
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  MediaSourceSettings,
  PlexServerSettings,
  ProgramOrFolder,
} from '@tunarr/types';
import type {
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMedia,
} from '@tunarr/types/plex';
import { compact, flatMap, isNil, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { getApiPlexByMediaSourceIdSearch } from '../../generated/sdk.gen.ts';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions.ts';
import { useQueryObserver } from '../useQueryObserver.ts';

const usePlexSearchQueryFn = () => {
  return useCallback(
    async (
      plexServer: PlexServerSettings,
      plexLibrary: PlexMediaSourceLibraryView,
      searchParam: Maybe<string>,
      parent?: Maybe<{ parentId: string; type: PlexMedia['type'] }>,
      pageParams?: { start: number; size: number },
    ) => {
      const { data } = await getApiPlexByMediaSourceIdSearch({
        path: {
          mediaSourceId: plexServer.id,
        },
        query: {
          key: parent?.parentId ?? plexLibrary.library.externalId,
          limit: pageParams?.size,
          offset: pageParams?.start,
          parentType: parent?.type,
          searchParam,
        },
        throwOnError: true,
      });
      return data;
      // const plexQuery = new URLSearchParams();

      // if (!isUndefined(pageParams)) {
      //   plexQuery.set('X-Plex-Container-Start', pageParams.start.toString());
      //   plexQuery.set('X-Plex-Container-Size', pageParams.size.toString());
      // }

      // // We cannot search when scoped to a parent
      // if (isEmpty(parent)) {
      //   // HACK for now
      //   forEach(searchParam?.split('&'), (keyval) => {
      //     const idx = keyval.lastIndexOf('=');
      //     if (idx !== -1) {
      //       plexQuery.append(
      //         keyval.substring(0, idx),
      //         keyval.substring(idx + 1),
      //       );
      //     }
      //   });
      // }

      // const path = match(parent)
      //   .with(
      //     { type: 'collection' },
      //     (p) => `/library/collections/${p.parentId}/children`,
      //   )
      //   .with({ type: 'playlist' }, (p) => `/playlists/${p.parentId}/items`)
      //   .with(P.nonNullable, (p) => {
      //     plexQuery.append('excludeAllLeaves', '1');
      //     return `/library/metadata/${p.parentId}/children`;
      //   })
      //   .otherwise(
      //     () => `/library/sections/${plexLibrary.library.externalId}/all`,
      //   );

      // return fetchPlexPath<PlexChildListing>(
      //   plexServer.id,
      //   `${path}?${plexQuery.toString()}`,
      // )();
    },
    [],
  );
};

const usePlexSearchQueryOptions = (
  plexServer: Maybe<MediaSourceSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  searchParam: Maybe<string>,
  enabled: boolean = true,
) => {
  const plexQueryFn = usePlexSearchQueryFn();
  return queryOptions({
    queryKey: [
      'plex-search',
      plexServer?.id,
      currentLibrary?.library.externalId,
      searchParam,
    ] as DataTag<
      ['plex-search', string, string, string],
      PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
    >,
    enabled:
      enabled &&
      !isNil(plexServer) &&
      plexServer.type === 'plex' &&
      !isNil(currentLibrary),
    queryFn: () => {
      return plexQueryFn(
        plexServer! as PlexServerSettings,
        currentLibrary!,
        searchParam,
      );
    },
  });
};

export const useDirectPlexSearch = (
  server: Maybe<MediaSourceSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  searchParam: Maybe<string>,
  enabled: boolean = true,
) => {
  const queryClient = useQueryClient();
  const options = usePlexSearchQueryOptions(
    server,
    currentLibrary,
    searchParam,
    enabled,
  );

  return () => {
    return queryClient.ensureQueryData(options);
  };
};

export const usePlexSearch = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  searchParam: Maybe<string>,
  enabled: boolean = true,
) => {
  const queryOptions = usePlexSearchQueryOptions(
    plexServer,
    currentLibrary,
    searchParam,
    enabled,
  );

  return useQuery(queryOptions);
};

const usePlexItemsInfiniteQueryOptions = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  searchParam: Maybe<string>,
  pageSize: number,
  parent: Maybe<{ parentId: string; type: ProgramOrFolder['type'] }>,
  enabled: boolean = true,
) => {
  return useMemo(() => {
    const key = [
      'plex-search',
      plexServer?.name,
      currentLibrary?.library.externalId,
      parent ?? searchParam,
      'infinite',
    ] as const;

    const opts = infiniteQueryOptions({
      queryKey: key,
      enabled: enabled && !isNil(plexServer) && !isNil(currentLibrary),
      initialPageParam: 0,
      queryFn: async ({ pageParam = 0 }) => {
        const { data } = await getApiPlexByMediaSourceIdSearch({
          path: {
            mediaSourceId: plexServer!.id,
          },
          query: {
            key: parent?.parentId ?? currentLibrary!.library.externalId,
            limit: pageSize,
            offset: pageParam,
            parentType: parent?.type,
            searchParam,
          },
          throwOnError: true,
        });
        return data;
      },
      getNextPageParam: (res, all, last) => {
        const total = sumBy(all, (page) => page.result.length);
        if (total >= res.total) {
          return;
        }

        // Next offset is the last + how many items we got back.
        return last + res.result.length;
      },
      // We can toy around with this... it's not great since it's all
      // on the frontend. Would be cool to have a true cache of library
      // items on the backend, but it's complicated! We don't want to rebuild
      // Plex...
      staleTime: 60_000 * 10,
    });

    return opts;
  }, [currentLibrary, enabled, pageSize, parent, plexServer, searchParam]);
};

export const usePlexItemsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  searchParam: Maybe<string>,
  pageSize: number,
  parent: Maybe<{ parentId: string; type: ProgramOrFolder['type'] }>,
  enabled: boolean = true,
) => {
  const queryOpts = usePlexItemsInfiniteQueryOptions(
    plexServer,
    currentLibrary,
    searchParam,
    pageSize,
    parent,
    enabled,
  );
  const query = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          const allItems = compact(
            flatMap(result.data.pages, (page) => page.result),
          );
          addKnownMediaForServer(
            plexServer!.id,
            allItems,
            parent?.parentId ?? currentLibrary?.library.uuid,
          );
        }
      },
      [currentLibrary?.library.uuid, parent?.parentId, plexServer],
    ),
  );

  return query;
};
