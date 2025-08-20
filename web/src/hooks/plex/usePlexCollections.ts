import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { PlexServerSettings } from '@tunarr/types';
import type { PlexLibraryCollections } from '@tunarr/types/plex';
import { flatten, isNil, reject, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import { addKnownMediaForPlexServer } from '../../store/programmingSelector/actions.ts';
import { useQueryObserver } from '../useQueryObserver.ts';

export const usePlexCollectionsInfinite = (
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
        currentLibrary?.library.key,
        'collections',
      ],
      queryFn: ({ pageParam }) => {
        const plexQuery = new URLSearchParams({
          'X-Plex-Container-Start': pageParam.toString(),
          'X-Plex-Container-Size': pageSize.toString(),
        });

        return fetchPlexPath<PlexLibraryCollections>(
          plexServer!.id,
          `/library/sections/${
            currentLibrary?.library.key
          }/collections?${plexQuery.toString()}`,
        )();
      },
      enabled:
        enabled &&
        !isNil(plexServer) &&
        !isNil(currentLibrary) &&
        currentLibrary.library.type !== 'artist',
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
  }, [currentLibrary, enabled, pageSize, plexServer]);

  const query = useInfiniteQuery(queryOpts);

  useQueryObserver(
    queryOpts,
    useCallback(
      (result) => {
        if (result.status === 'success') {
          const results = flatten(
            seq.collect(
              reject(result.data.pages, (page) => page.size === 0),
              (page) => page.Metadata,
            ),
          );

          addKnownMediaForPlexServer(plexServer!.id, results);
        }
      },
      [plexServer],
    ),
  );

  return query;
};
