import {
  DataTag,
  DefinedInitialDataOptions,
  QueriesResults,
  UseQueryResult,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { CustomProgram, CustomShow } from '@tunarr/types';
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

// Tried to do a clever overload here but it's easier to just blow out the  method
// and get the rid type inference...
export function useCustomShowWithInitialData(
  apiClient: ApiClient,
  id: string,
  enabled: boolean,
  initialData: { customShow: CustomShow; programs: CustomProgram[] },
) {
  return useQueries({
    queries: [
      {
        ...customShowQuery(apiClient, id),
        enabled,
        initialData: initialData?.customShow,
      },
      {
        ...customShowProgramsQuery(apiClient, id),
        enabled: enabled,
        initialData: initialData?.programs,
      },
    ],
  });
}

export function useCustomShow(
  apiClient: ApiClient,
  id: string,
  enabled: boolean,
  includePrograms: boolean,
  initialData: { customShow?: CustomShow; programs?: CustomProgram[] } = {},
): QueriesResults<
  [UseQueryResult<CustomShow>, UseQueryResult<CustomProgram[]>]
> {
  return useQueries({
    queries: [
      {
        ...customShowQuery(apiClient, id),
        enabled,
        initialData: initialData?.customShow,
      },
      {
        ...customShowProgramsQuery(apiClient, id),
        enabled: enabled && includePrograms,
        initialData: initialData?.programs,
      },
    ],
  });
}
