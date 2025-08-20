import { isNonEmptyString } from '@/helpers/util.ts';
import { addKnownMediaForPlexServer } from '@/store/programmingSelector/actions.ts';
import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { PlexServerSettings } from '@tunarr/types';
import type { PlexPlaylists } from '@tunarr/types/plex';
import { flatten, isNil, reject, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
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
        currentLibrary?.library.key ?? 'all',
        'playlists',
        'infinite',
      ],
      queryFn: ({ pageParam }) => {
        const plexQuery = new URLSearchParams({
          type: '15',

          'X-Plex-Container-Start': pageParam.toString(),
          'X-Plex-Container-Size': pageSize.toString(),
        });

        if (isNonEmptyString(currentLibrary?.library.key)) {
          plexQuery.set('sectionID', currentLibrary.library.key);
        }

        return fetchPlexPath<PlexPlaylists>(
          plexServer!.id,
          `/playlists?${plexQuery.toString()}`,
        )();
      },
      enabled: !isNil(plexServer) && enabled,
      initialPageParam: 0,
      getNextPageParam: (res, all, last) => {
        const total = sumBy(all, (page) => page.size);
        if (total >= (res.totalSize ?? res.size)) {
          return null;
        }

        // Next offset is the last + how many items we got back.
        return last + res.size;
      },
    });
  }, [currentLibrary?.library.key, enabled, pageSize, plexServer]);

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
