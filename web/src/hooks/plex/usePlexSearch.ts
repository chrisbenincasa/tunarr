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
import type { MediaSourceSettings, PlexServerSettings } from '@tunarr/types';
import type {
  PlexChildListing,
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
  PlexMedia,
} from '@tunarr/types/plex';
import type { MediaSourceId } from '@tunarr/types/schemas';
import {
  flatMap,
  forEach,
  isEmpty,
  isNil,
  isUndefined,
  sumBy,
} from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { match, P } from 'ts-pattern';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import { addKnownMediaForPlexServer } from '../../store/programmingSelector/actions.ts';
import { useQueryObserver } from '../useQueryObserver.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

const usePlexSearchQueryFn = () => {
  const apiClient = useTunarrApi();

  return useCallback(
    (
      plexServer: PlexServerSettings,
      plexLibrary: PlexMediaSourceLibraryView,
      searchParam: Maybe<string>,
      parent?: Maybe<{ parentId: string; type: PlexMedia['type'] }>,
      pageParams?: { start: number; size: number },
    ) => {
      const plexQuery = new URLSearchParams();

      if (!isUndefined(pageParams)) {
        plexQuery.set('X-Plex-Container-Start', pageParams.start.toString());
        plexQuery.set('X-Plex-Container-Size', pageParams.size.toString());
      }

      // We cannot search when scoped to a parent
      if (isEmpty(parent)) {
        // HACK for now
        forEach(searchParam?.split('&'), (keyval) => {
          const idx = keyval.lastIndexOf('=');
          if (idx !== -1) {
            plexQuery.append(
              keyval.substring(0, idx),
              keyval.substring(idx + 1),
            );
          }
        });
      }

      const path = match(parent)
        .with(
          { type: 'collection' },
          (p) => `/library/collections/${p.parentId}/children`,
        )
        .with({ type: 'playlist' }, (p) => `/playlists/${p.parentId}/items`)
        .with(P.nonNullable, (p) => {
          plexQuery.append('excludeAllLeaves', '1');
          return `/library/metadata/${p.parentId}/children`;
        })
        .otherwise(() => `/library/sections/${plexLibrary.library.key}/all`);

      return fetchPlexPath<PlexChildListing>(
        apiClient,
        plexServer.id,
        `${path}?${plexQuery.toString()}`,
      )();
    },
    [apiClient],
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
      currentLibrary?.library.key,
      searchParam,
    ] as DataTag<
      ['plex-search', MediaSourceId, string, string],
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
  parent: Maybe<{ parentId: string; type: PlexMedia['type'] }>,
  enabled: boolean = true,
) => {
  const plexQueryFn = usePlexSearchQueryFn();

  return useMemo(() => {
    console.log('here');
    const key = [
      'plex-search',
      plexServer?.name,
      currentLibrary?.library.key,
      parent ?? searchParam,
      'infinite',
    ] as const;

    const opts = infiniteQueryOptions({
      queryKey: key,
      enabled: enabled && !isNil(plexServer) && !isNil(currentLibrary),
      initialPageParam: 0,
      queryFn: ({ pageParam }) => {
        return plexQueryFn(plexServer!, currentLibrary!, searchParam, parent, {
          start: pageParam,
          size: pageSize,
        });
      },
      getNextPageParam: (res, all, last) => {
        const total = sumBy(all, (page) => page.size);
        if (total >= (res.totalSize ?? res.size)) {
          return;
        }

        // Next offset is the last + how many items we got back.
        return last + res.size;
      },
      // We can toy around with this... it's not great since it's all
      // on the frontend. Would be cool to have a true cache of library
      // items on the backend, but it's complicated! We don't want to rebuild
      // Plex...
      staleTime: 60_000 * 10,
    });

    return opts;
  }, [
    currentLibrary,
    enabled,
    pageSize,
    parent,
    plexQueryFn,
    plexServer,
    searchParam,
  ]);
};

export const usePlexItemsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  searchParam: Maybe<string>,
  pageSize: number,
  parent: Maybe<{ parentId: string; type: PlexMedia['type'] }>,
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
          const allItems = flatMap(result.data.pages, (page) => page.Metadata);
          addKnownMediaForPlexServer(
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
