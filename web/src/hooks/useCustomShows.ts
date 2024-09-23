import {
  DataTag,
  DefinedInitialDataOptions,
  useQueries,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { CustomProgram, CustomShow } from '@tunarr/types';
import { ApiClient } from '../external/api.ts';
import { ZodiosAliasReturnType } from '../types/index.ts';
import { makeQueryOptions } from './useQueryHelpers.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export type CustomShowsQueryOpts<TData = CustomShow[]> = Omit<
  DefinedInitialDataOptions<
    CustomShow[],
    Error,
    TData,
    DataTag<['custom-shows'], CustomShow[]>
  >,
  'queryKey' | 'queryFn' | 'initialData'
>;

export const customShowsQuery = <TOut = CustomShow[]>(
  apiClient: ApiClient,
  opts?: CustomShowsQueryOpts<TOut>,
) => makeQueryOptions(['custom-shows'], () => apiClient.getCustomShows(), opts);

export const useCustomShows = <TOut = CustomShow[]>(
  opts?: CustomShowsQueryOpts<TOut>,
) => {
  const apiClient = useTunarrApi();
  return useSuspenseQuery(customShowsQuery(apiClient, opts ?? {}));
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

export function useCustomShowWithProgramming(apiClient: ApiClient, id: string) {
  return useSuspenseQueries({
    queries: [
      {
        ...customShowQuery(apiClient, id),
      },
      {
        ...customShowProgramsQuery(apiClient, id),
      },
    ],
  });
}
