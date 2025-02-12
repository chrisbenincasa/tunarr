import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { PlexServerSettings } from '@tunarr/types';
import { flatten, isNil, reject, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { addKnownMediaForPlexServer } from '../../store/programmingSelector/actions.ts';
import { useQueryObserver } from '../useQueryObserver.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

export const usePlexCollectionsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const apiClient = useTunarrApi();

  const queryOpts = useMemo(() => {
    return infiniteQueryOptions({
      queryKey: [
        'plex',
        plexServer?.id,
        currentLibrary?.library.key,
        'collections',
      ],
      queryFn: ({ pageParam }) => {
        return apiClient.getPlexLibraryCollections({
          params: {
            mediaSourceId: plexServer!.id,
            libraryId: currentLibrary!.library.key,
          },
          queries: {
            offset: pageParam,
            limit: pageSize,
          },
        });
      },
      enabled:
        enabled &&
        !isNil(plexServer) &&
        !isNil(currentLibrary) &&
        currentLibrary.library.type !== 'artist',
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
    });
  }, [apiClient, currentLibrary, enabled, pageSize, plexServer]);

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
