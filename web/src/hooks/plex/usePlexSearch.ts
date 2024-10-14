import { PlexLibrary } from '@/store/programmingSelector/store.ts';
import { Maybe, Nilable } from '@/types/util.ts';
import {
  DataTag,
  infiniteQueryOptions,
  queryOptions,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { MediaSourceSettings, PlexServerSettings } from '@tunarr/types';
import {
  PlexLibraryMovies,
  PlexLibraryMusic,
  PlexLibraryShows,
} from '@tunarr/types/plex';
import { MediaSourceId } from '@tunarr/types/schemas';
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
      plexServer.id,
      `/library/sections/${
        plexLibrary.library.key
      }/all?${plexQuery.toString()}`,
    )();
  };
};

const usePlexSearchQueryOptions = (
  plexServer: Maybe<MediaSourceSettings>,
  currentLibrary: Nilable<PlexLibrary>,
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
  currentLibrary: Nilable<PlexLibrary>,
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

const usePlexSearchInfiniteQueryOptions = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexLibrary>,
  searchParam: Maybe<string>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const plexQueryFn = usePlexSearchQueryFn();

  const key = [
    'plex-search',
    plexServer?.name,
    currentLibrary?.library.key,
    searchParam,
    'infinite',
  ] as const;

  const opts = infiniteQueryOptions({
    queryKey: key,
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
    // We can toy around with this... it's not great since it's all
    // on the frontend. Would be cool to have a true cache of library
    // items on the backend, but it's complicated! We don't want to rebuild
    // Plex...
    staleTime: 60_000 * 10,
  });

  return opts;
};

export const usePlexSearchInfinite = (
  plexServer: Maybe<PlexServerSettings>,
  currentLibrary: Nilable<PlexLibrary>,
  searchParam: Maybe<string>,
  pageSize: number,
  enabled: boolean = true,
) => {
  const queryOpts = usePlexSearchInfiniteQueryOptions(
    plexServer,
    currentLibrary,
    searchParam,
    pageSize,
    enabled,
  );

  return useInfiniteQuery(queryOpts);
};
