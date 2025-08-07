import type { DataTag } from '@tanstack/react-query';
import {
  queryOptions,
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import type { MediaSourceId } from '@tunarr/types/schemas';
import { useCallback } from 'react';
import type { StrictOmit } from 'ts-essentials';
import type { ApiClient } from '../../external/api.ts';
import { queryClient } from '../../queryClient.ts';
import type { Maybe } from '../../types/util.ts';
import { MediaSourcesQueryKey } from '../settingsHooks.ts';
import { useApiQuery } from '../useApiQuery.ts';
import { useTunarrApi } from '../useTunarrApi.ts';
import { MediaSourceLibrariesQueryKey } from './useMediaSourceLibraries.ts';

type EnableMutationArgs = {
  mediaSourceId: MediaSourceId;
  libraryId: string;
  enabled: boolean;
};

type RefreshMutationArgs = {
  mediaSourceId: MediaSourceId;
  libraryId: string;
  forceScan: boolean;
};

const useUpdateQueryCachedLibraries = () => {
  const queryClient = useQueryClient();
  const onMutate = useCallback(
    async (
      mediaSourceId: MediaSourceId,
      libraryId: string,
      mutateLibrary: (
        lib: StrictOmit<MediaSourceLibrary, 'mediaSource'>,
      ) => StrictOmit<MediaSourceLibrary, 'mediaSource'>,
    ) => {
      const librariesQueryKey = MediaSourceLibrariesQueryKey(mediaSourceId);
      await queryClient.cancelQueries({ queryKey: librariesQueryKey });
      await queryClient.cancelQueries({ queryKey: MediaSourcesQueryKey });

      const prevLibraries = queryClient.getQueryData(librariesQueryKey);
      queryClient.setQueryData(librariesQueryKey, (prev) => {
        return prev?.map((library) => {
          if (library.id === libraryId) {
            const out = mutateLibrary(library);
            return {
              ...out,
              mediaSource: library.mediaSource,
            };
          }
          return library;
        });
      });

      const prevMediaSources = queryClient.getQueryData(MediaSourcesQueryKey);
      queryClient.setQueryData(MediaSourcesQueryKey, (prev) => {
        return prev?.map((source) => {
          if (source.id !== mediaSourceId) {
            return source;
          }
          return {
            ...source,
            libraries: source.libraries.map((lib) => {
              if (lib.id !== libraryId) {
                return lib;
              }
              return mutateLibrary(lib);
            }),
          };
        });
      });

      return { prevLibraries, prevMediaSources };
    },
    [queryClient],
  );

  const onError = useCallback(
    (
      mediaSourceId: MediaSourceId,
      prevLibraries: Maybe<MediaSourceLibrary[]>,
      prevMediaSources: Maybe<MediaSourceSettings[]>,
    ) => {
      queryClient.setQueryData(
        MediaSourceLibrariesQueryKey(mediaSourceId),
        prevLibraries,
      );
      queryClient.setQueryData(MediaSourcesQueryKey, prevMediaSources);
    },
    [queryClient],
  );

  return {
    onMutate,
    onError,
  };
};

export const useUpdateLibraryMutation = () => {
  const apiClient = useTunarrApi();
  const updateQueryCachedLibraries = useUpdateQueryCachedLibraries();

  return useMutation({
    mutationFn: (args: EnableMutationArgs) => {
      return apiClient.updateMediaLibrary(
        { enabled: args.enabled },
        {
          params: {
            libraryId: args.libraryId,
            mediaSourceId: args.mediaSourceId,
          },
        },
      );
    },
    onMutate: async (args: EnableMutationArgs) => {
      return updateQueryCachedLibraries.onMutate(
        args.mediaSourceId,
        args.libraryId,
        (lib) => ({
          ...lib,
          enabled: args.enabled,
        }),
      );
    },
    onError: (err, args, context) => {
      console.error(err);
      updateQueryCachedLibraries.onError(
        args.mediaSourceId,
        context?.prevLibraries,
        context?.prevMediaSources,
      );
    },
    onSettled: (_data, _err, args) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: MediaSourceLibrariesQueryKey(args.mediaSourceId),
        }),
        queryClient.invalidateQueries({
          queryKey: MediaSourcesQueryKey,
        }),
      ]),
  });
};

export const useLibraryScanState = (
  libraryId: string,
  enabled: boolean,
  interval: number = 5000,
) => {
  return useApiQuery({
    enabled,
    queryKey: ['media-source-library', libraryId, 'status'],
    queryFn: (api) => api.getMediaLibraryStatus({ params: { libraryId } }),
    refetchInterval: interval,
    staleTime: 0,
  });
};

export const useRefreshLibraryMutation = () => {
  const apiClient = useTunarrApi();
  const updateQueryCachedLibraries = useUpdateQueryCachedLibraries();

  return useMutation({
    mutationFn: (args: RefreshMutationArgs) =>
      apiClient.refreshMediaLibrary(undefined, {
        params: {
          libraryId: args.libraryId,
          mediaSourceId: args.mediaSourceId,
        },
        queries: {
          forceScan: args.forceScan,
        },
      }),
    onMutate: async (args: RefreshMutationArgs) => {
      return updateQueryCachedLibraries.onMutate(
        args.mediaSourceId,
        args.libraryId,
        (lib) => ({
          ...lib,
          isLocked: true,
        }),
      );
    },
    onError: (err, args, context) => {
      console.error(err);
      updateQueryCachedLibraries.onError(
        args.mediaSourceId,
        context?.prevLibraries,
        context?.prevMediaSources,
      );
    },
    onSettled: (_data, _err, args) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: MediaSourceLibrariesQueryKey(args.mediaSourceId),
        }),
        queryClient.invalidateQueries({
          queryKey: MediaSourcesQueryKey,
        }),
      ]),
  });
};

export const MediaSourceLibraryQueryKey = (libraryId: string) =>
  ['media-source-library', libraryId] as DataTag<
    ['media-source-library', string],
    MediaSourceLibrary
  >;

export const MediaSourceLibraryQueryOpts = (
  libraryId: string,
  tunarrClient: ApiClient,
) =>
  queryOptions({
    queryKey: MediaSourceLibraryQueryKey(libraryId),
    queryFn: () => tunarrClient.getMediaLibrary({ params: { libraryId } }),
  });

export const useMediaSourceLibrary = (libraryId: string) => {
  const apiClient = useTunarrApi();
  return useSuspenseQuery(MediaSourceLibraryQueryOpts(libraryId, apiClient));
};
