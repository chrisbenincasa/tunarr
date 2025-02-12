import { addKnownMediaForPlexServer } from '@/store/programmingSelector/actions.ts';
import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { PlexServerSettings } from '@tunarr/types';
import { flatten, isNil, reject, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { useQueryObserver } from '../useQueryObserver.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

/**
 * Currently makes the assumption that are operating on an a music library
 * within Plex
 */
export const usePlexPlaylistsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const apiClient = useTunarrApi();

  const queryOpts = useMemo(
    () =>
      infiniteQueryOptions({
        queryKey: [
          'plex',
          plexServer?.id,
          currentLibrary?.library.key ?? 'all',
          'playlists',
          'infinite',
        ],
        queryFn: ({ pageParam }) => {
          // const plexQuery = new URLSearchParams({
          //   type: '15',

          //   'X-Plex-Container-Start': pageParam.toString(),
          //   'X-Plex-Container-Size': pageSize.toString(),
          // });

          // if (isNonEmptyString(currentLibrary?.library.key)) {
          //   plexQuery.set('sectionID', currentLibrary.library.key);
          // }

          return apiClient.getPlexLibraryPlaylists({
            params: {
              mediaSourceId: plexServer!.id,
              libraryId: currentLibrary?.library.key ?? 'all',
            },
            queries: {
              offset: pageParam,
              limit: pageSize,
            },
          });

          // return fetchPlexPath<PlexPlaylists>(
          //   apiClient,
          //   plexServer!.id,
          //   `/playlists?${plexQuery.toString()}`,
          // )();
        },
        enabled: !isNil(plexServer) && enabled,
        initialPageParam: 0,
        getNextPageParam: (res, all, last) => {
          const total = sumBy(all, (page) => page.MediaContainer.size);
          if (
            total >= (res.MediaContainer.totalSize ?? res.MediaContainer.size)
          ) {
            return null;
          }

          // Next offset is the last + how many items we got back.
          return last + res.MediaContainer.size;
        },
        select(data) {
          return {
            ...data,
            pages: data.pages.map((page) => page.MediaContainer),
          };
        },
      }),
    [apiClient, currentLibrary?.library.key, enabled, pageSize, plexServer],
  );

  const queryResult = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          const playlists = flatten(
            seq.collect(
              reject(result.data.pages, (page) => page.size === 0),
              (page) => page.Metadata,
            ),
          );
          addKnownMediaForPlexServer(plexServer!.id, playlists);
        }
      },
      [plexServer],
    ),
  );

  return queryResult;
};
