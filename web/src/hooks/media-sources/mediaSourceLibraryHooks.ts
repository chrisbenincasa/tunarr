import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { MediaSourceLibrary, MediaSourceSettings } from '@tunarr/types';
import { useCallback } from 'react';
import type { StrictOmit } from 'ts-essentials';
import {
  getMediaLibraryByIdOptions,
  getMediaSourceLibrariesQueryKey,
  getMediaSourceScanStatusOptions,
  getMediaSourcesQueryKey,
  scanMediaSourceLibraryMutation,
  updateMediaSourceLibraryMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import type { Options } from '../../generated/client/types.gen.ts';
import type {
  GetMediaSourceLibrariesResponses,
  GetMediaSourcesResponses,
  ScanMediaSourceLibraryData,
  UpdateMediaSourceLibraryData,
} from '../../generated/types.gen.ts';
import { queryClient } from '../../queryClient.ts';
import type { Maybe } from '../../types/util.ts';

const useUpdateQueryCachedLibraries = () => {
  const queryClient = useQueryClient();
  const onMutate = useCallback(
    async (
      mediaSourceId: string,
      libraryId: string,
      mutateLibrary: (
        lib: StrictOmit<MediaSourceLibrary, 'mediaSource'>,
      ) => StrictOmit<MediaSourceLibrary, 'mediaSource'>,
    ) => {
      const librariesQueryKey = getMediaSourceLibrariesQueryKey({
        path: { id: mediaSourceId },
      });
      await queryClient.cancelQueries({
        queryKey: getMediaSourceLibrariesQueryKey({
          path: { id: mediaSourceId },
        }),
      });
      await queryClient.cancelQueries({
        queryKey: getMediaSourcesQueryKey(),
      });

      const prevLibraries =
        queryClient.getQueryData<GetMediaSourceLibrariesResponses[200]>(
          librariesQueryKey,
        );
      queryClient.setQueryData<GetMediaSourceLibrariesResponses[200]>(
        librariesQueryKey,
        (prev) => {
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
        },
      );

      const prevMediaSources = queryClient.getQueryData<
        GetMediaSourcesResponses[200]
      >(getMediaSourcesQueryKey());
      queryClient.setQueryData<GetMediaSourcesResponses[200]>(
        getMediaSourcesQueryKey(),
        (prev) => {
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
        },
      );

      return { prevLibraries, prevMediaSources };
    },
    [queryClient],
  );

  const onError = useCallback(
    (
      mediaSourceId: string,
      prevLibraries: Maybe<MediaSourceLibrary[]>,
      prevMediaSources: Maybe<MediaSourceSettings[]>,
    ) => {
      queryClient.setQueryData(
        getMediaSourceLibrariesQueryKey({
          path: { id: mediaSourceId },
        }),
        prevLibraries,
      );
      queryClient.setQueryData(getMediaSourcesQueryKey(), prevMediaSources);
    },
    [queryClient],
  );

  return {
    onMutate,
    onError,
  };
};

export const useUpdateLibraryMutation = () => {
  const updateQueryCachedLibraries = useUpdateQueryCachedLibraries();

  return useMutation({
    ...updateMediaSourceLibraryMutation(),
    onMutate: async (
      args: Options<UpdateMediaSourceLibraryData>,
    ) => {
      return updateQueryCachedLibraries.onMutate(
        args.path.id,
        args.path.libraryId,
        (lib) => ({
          ...lib,
          enabled: args.body.enabled,
        }),
      );
    },
    onError: (err, args, context) => {
      console.error(err);
      updateQueryCachedLibraries.onError(
        args.path.id,
        context?.prevLibraries,
        context?.prevMediaSources,
      );
    },
    onSettled: (_data, _err, args) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: getMediaSourceLibrariesQueryKey({
            path: { id: args.path.id },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getMediaSourcesQueryKey(),
        }),
      ]),
  });
};

export const useLibraryScanState = (
  mediaSourceId: string,
  libraryId: string,
  enabled: boolean,
  interval: number = 5000,
) => {
  return useQuery({
    ...getMediaSourceScanStatusOptions({
      path: {
        mediaSourceId,
        libraryId,
      },
    }),
    refetchInterval: interval,
    staleTime: 0,
    enabled,
  });
};

export const useScanMediaSourceMutation = () => {
  const updateQueryCachedLibraries = useUpdateQueryCachedLibraries();

  return useMutation({
    ...scanMediaSourceLibraryMutation(),
    onMutate: async (
      args: Options<ScanMediaSourceLibraryData>,
    ) => {
      return updateQueryCachedLibraries.onMutate(
        args.path.id,
        args.path.libraryId,
        (lib) => ({
          ...lib,
          isLocked: true,
        }),
      );
    },
    onError: (err, args, context) => {
      console.error(err);
      updateQueryCachedLibraries.onError(
        args.path.id,
        context?.prevLibraries,
        context?.prevMediaSources,
      );
    },
    onSettled: (_data, _err, args) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: getMediaSourceLibrariesQueryKey({
            path: { id: args.path.id },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getMediaSourcesQueryKey(),
        }),
      ]),
  });
};

export const useScanLibraryMutation = () => {
  const updateQueryCachedLibraries = useUpdateQueryCachedLibraries();

  return useMutation({
    ...scanMediaSourceLibraryMutation(),
    onMutate: async (
      args: Options<ScanMediaSourceLibraryData>,
    ) => {
      return updateQueryCachedLibraries.onMutate(
        args.path.id,
        args.path.libraryId,
        (lib) => ({
          ...lib,
          isLocked: true,
        }),
      );
    },
    onError: (err, args, context) => {
      console.error(err);
      updateQueryCachedLibraries.onError(
        args.path.id,
        context?.prevLibraries,
        context?.prevMediaSources,
      );
    },
    onSettled: (_data, _err, args) =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: getMediaSourceLibrariesQueryKey({
            path: { id: args.path.id },
          }),
        }),
        queryClient.invalidateQueries({
          queryKey: getMediaSourcesQueryKey(),
        }),
      ]),
  });
};

export const MediaSourceLibraryQueryOpts = (libraryId: string) =>
  getMediaLibraryByIdOptions({ path: { libraryId } });

export const useMediaSourceLibrary = (libraryId: string) => {
  return useSuspenseQuery(MediaSourceLibraryQueryOpts(libraryId));
};
