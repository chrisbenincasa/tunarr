import {
  DataTag,
  DefinedInitialDataOptions,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { CustomShow } from '@tunarr/types';
import { ApiClient } from '../external/api.ts';
import { ZodiosAliasReturnType } from '../types/index.ts';
import { makeQueryOptionsInitialData } from './useQueryHelpers.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export type CustomShowsQueryOpts = Omit<
  DefinedInitialDataOptions<
    CustomShow[],
    Error,
    CustomShow[],
    DataTag<['custom-shows'], CustomShow[]>
  >,
  'queryKey' | 'queryFn' | 'initialData'
>;

export const customShowsQuery = (
  apiClient: ApiClient,
  initialData: CustomShow[] = [],
  opts?: CustomShowsQueryOpts,
) =>
  makeQueryOptionsInitialData(
    ['custom-shows'],
    () => apiClient.getCustomShows(),
    initialData,
    opts ?? {},
  );

export const useCustomShows = (
  initialData: CustomShow[] = [],
  opts?: CustomShowsQueryOpts,
) => {
  const apiClient = useTunarrApi();
  return useQuery(customShowsQuery(apiClient, initialData, opts ?? {}));
};

export const customShowQuery = (apiClient: ApiClient, id: string) => ({
  queryKey: ['custom-shows', id] as DataTag<
    ['custom-shows', string],
    ZodiosAliasReturnType<'getCustomShow'>
  >,
  queryFn: () => apiClient.getCustomShow({ params: { id } }),
});

export const customShowProgramsQuery = (apiClient: ApiClient, id: string) => ({
  queryKey: ['custom-shows', id, 'programs'] as DataTag<
    ['custom-shows', string, 'programs'],
    ZodiosAliasReturnType<'getCustomShowPrograms'>
  >,
  queryFn: () => apiClient.getCustomShowPrograms({ params: { id } }),
});

export const useCustomShow = (
  apiClient: ApiClient,
  id: string,
  enabled: boolean,
  includePrograms: boolean,
) => {
  return useQueries({
    queries: [
      { ...customShowQuery(apiClient, id), enabled },
      {
        ...customShowProgramsQuery(apiClient, id),
        enabled: enabled && includePrograms,
      },
    ],
  });
};
