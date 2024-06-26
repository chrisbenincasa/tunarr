import { PlexLibrary } from '@/store/programmingSelector/store.ts';
import { Maybe, Nilable } from '@/types/util.ts';
import {
  DataTag,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { PlexServerSettings } from '@tunarr/types';
import {
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
} from '@tunarr/types/plex';
import { forEach, isNil, isUndefined, sumBy } from 'lodash-es';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import { useTunarrApi } from '../useTunarrApi.ts';

const usePlexSearchQueryFn = () => {
  const apiClient = useTunarrApi();

  return (
    plexServer: PlexServerSettings,
    plexLibrary: PlexLibrary,
    searchParam: Maybe<string>,
    pageParams?: { start: number; size: number },
  ) => {
    const plexQuery = new URLSearchParams();

    if (!isUndefined(pageParams)) {
      plexQuery.set('X-Plex-Container-Start', pageParams.start.toString());
      plexQuery.set('X-Plex-Container-Size', pageParams.size.toString());
    }

    // HACK for now
    forEach(searchParam?.split('&'), (keyval) => {
      const idx = keyval.lastIndexOf('=');
      if (idx !== -1) {
        plexQuery.append(keyval.substring(0, idx), keyval.substring(idx + 1));
      }
    });

    return fetchPlexPath<
      PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
    >(
      apiClient,
      plexServer.name,
      `/library/sections/${
        plexLibrary.library.key
      }/all?${plexQuery.toString()}`,
    )();
  };
};

const usePlexSearchQueryOptions = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexLibrary>,
  searchParam: Maybe<string>,
  enabled: boolean = true,
) => {
  const plexQueryFn = usePlexSearchQueryFn();
  return queryOptions({
    queryKey: [
      'plex-search',
      plexServer?.name,
      currentLibrary?.library.key,
      searchParam,
    ] as DataTag<
      ['plex-search', string, string, string],
      PlexLibraryMovies | PlexLibraryShows | PlexLibraryMusic
    >,
    enabled: enabled && !isNil(plexServer) && !isNil(currentLibrary),
    queryFn: () => {
      return plexQueryFn(plexServer!, currentLibrary!, searchParam);
    },
  });
};

export const useDirectPlexSearch = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexLibrary>,
  searchParam: Maybe<string>,
  enabled: boolean = true,
) => {
  const queryClient = useQueryClient();
  const options = usePlexSearchQueryOptions(
    plexServer,
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
  currentLibrary: Nilable<PlexLibrary>,
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

export const usePlexSearchInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexLibrary>,
  searchParam: Maybe<string>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const plexQueryFn = usePlexSearchQueryFn();

  return useInfiniteQuery({
    queryKey: [
      'plex-search',
      plexServer?.name,
      currentLibrary?.library.key,
      searchParam,
      'infinite',
    ],
    enabled: enabled && !isNil(plexServer) && !isNil(currentLibrary),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => {
      return plexQueryFn(plexServer!, currentLibrary!, searchParam, {
        start: pageParam,
        size: pageSize,
      });
    },
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
