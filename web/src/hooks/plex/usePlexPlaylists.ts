import { addKnownMediaForServer } from '@/store/programmingSelector/actions.ts';
import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { PlexServerSettings } from '@tunarr/types';
import { flatten, isNil, reject, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import {
  getApiPlexByMediaSourceIdLibrariesByLibraryIdPlaylists,
  getApiPlexByMediaSourceIdPlaylists,
} from '../../generated/sdk.gen.ts';
import { useQueryObserver } from '../useQueryObserver.ts';

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
  const queryOpts = useMemo(() => {
    return infiniteQueryOptions({
      queryKey: [
        'plex',
        plexServer?.id,
        currentLibrary?.library.externalId ?? 'all',
        'playlists',
        'infinite',
      ],
      queryFn: async ({ pageParam = 0 }) => {
        const result =
          await getApiPlexByMediaSourceIdLibrariesByLibraryIdPlaylists({
            path: {
              mediaSourceId: plexServer!.id,
              libraryId: currentLibrary!.library.externalId,
            },
            query: {
              offset: pageParam,
              limit: pageSize,
            },
            throwOnError: true,
          });

        return result.data;
      },
      enabled: !isNil(plexServer) && enabled,
      initialPageParam: 0,
      getNextPageParam: (res, all, last) => {
        const total = sumBy(all, (page) => page.size);
        if (total >= (res.total < 0 ? res.size : res.total)) {
          return null;
        }

        // Next offset is the last + how many items we got back.
        return last + res.size;
      },
    });
  }, [currentLibrary, enabled, pageSize, plexServer]);

  const queryResult = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          const playlists = flatten(
            seq.collect(
              reject(result.data.pages, (page) => page.size === 0),
              (page) => page.result,
            ),
          );
          addKnownMediaForServer(plexServer!.id, playlists);
        }
      },
      [plexServer],
    ),
  );

  return queryResult;
};

export const usePlexTopLevelPlaylistsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  // currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const queryOpts = useMemo(() => {
    return infiniteQueryOptions({
      queryKey: [
        'plex',
        plexServer?.id,
        // currentLibrary?.library.externalId ?? 'all',
        'playlists',
        'infinite',
      ],
      queryFn: async ({ pageParam = 0 }) => {
        const result = await getApiPlexByMediaSourceIdPlaylists({
          path: {
            mediaSourceId: plexServer!.id,
          },
          query: {
            offset: pageParam,
            limit: pageSize,
          },
          throwOnError: true,
        });

        return result.data;
      },
      enabled: !isNil(plexServer) && enabled,
      initialPageParam: 0,
      getNextPageParam: (res, all, last) => {
        const total = sumBy(all, (page) => page.size);
        if (total >= (res.total < 0 ? res.size : res.total)) {
          return null;
        }

        // Next offset is the last + how many items we got back.
        return last + res.size;
      },
    });
  }, [enabled, pageSize, plexServer]);

  const queryResult = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          const playlists = flatten(
            seq.collect(
              reject(result.data.pages, (page) => page.size === 0),
              (page) => page.result,
            ),
          );
          addKnownMediaForServer(plexServer!.id, playlists);
        }
      },
      [plexServer],
    ),
  );

  return queryResult;
};
