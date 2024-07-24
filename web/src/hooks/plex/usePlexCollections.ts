import { PlexLibrary } from '@/store/programmingSelector/store.ts';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { PlexServerSettings } from '@tunarr/types';
import { PlexLibraryCollections } from '@tunarr/types/plex';
import { isNil, sumBy } from 'lodash-es';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import { useTunarrApi } from '../useTunarrApi.ts';
import { Maybe, Nilable } from '@/types/util.ts';

export const usePlexCollectionsInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexLibrary>,
  pageSize: number,
) => {
  const apiClient = useTunarrApi();

  return useInfiniteQuery({
    queryKey: [
      'plex',
      plexServer?.name,
      currentLibrary?.library.key,
      'collections',
    ],
    queryFn: ({ pageParam }) => {
      const plexQuery = new URLSearchParams({
        'X-Plex-Container-Start': pageParam.toString(),
        'X-Plex-Container-Size': pageSize.toString(),
      });

      return fetchPlexPath<PlexLibraryCollections>(
        apiClient,
        plexServer!.name,
        `/library/sections/${currentLibrary?.library
          .key}/collections?${plexQuery.toString()}`,
      )();
    },
    enabled:
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
};
