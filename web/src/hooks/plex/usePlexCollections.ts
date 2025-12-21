import type { PlexMediaSourceLibraryView } from '@/store/programmingSelector/store.ts';
import type { Maybe, Nilable } from '@/types/util.ts';
import { infiniteQueryOptions, useInfiniteQuery } from '@tanstack/react-query';
import { seq } from '@tunarr/shared/util';
import type { PlexServerSettings } from '@tunarr/types';
import { flatten, isNil, reject, sumBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { getApiPlexByMediaSourceIdLibrariesByLibraryIdCollectionsInfiniteQueryKey } from '../../generated/@tanstack/react-query.gen.ts';
import { getApiPlexByMediaSourceIdLibrariesByLibraryIdCollections } from '../../generated/sdk.gen.ts';
import { addKnownMediaForServer } from '../../store/programmingSelector/actions.ts';
import { useQueryObserver } from '../useQueryObserver.ts';

export const usePlexCollectionsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexMediaSourceLibraryView>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const queryOpts = useMemo(() => {
    return infiniteQueryOptions({
      queryKey:
        getApiPlexByMediaSourceIdLibrariesByLibraryIdCollectionsInfiniteQueryKey(
          {
            path: {
              mediaSourceId: plexServer?.id ?? '',
              libraryId: currentLibrary?.library.externalId ?? '',
            },
            query: {
              // offset: pageParam,
              limit: pageSize,
            },
          },
        ),
      queryFn: async (ctx) => {
        const { pageParam } = ctx;
        const result =
          await getApiPlexByMediaSourceIdLibrariesByLibraryIdCollections({
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
      enabled:
        enabled &&
        !isNil(plexServer) &&
        !isNil(currentLibrary) &&
        currentLibrary.library.childType !== 'artist',
      initialPageParam: 0,
      getNextPageParam: (res, all, last) => {
        const total = sumBy(all, (page) => page.size);
        if (total >= (res.total ?? res.size)) {
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
              (page) => page.result,
            ),
          );
          addKnownMediaForServer(plexServer!.id, results);
        }
      },
      [plexServer],
    ),
  );

  return query;
};
