import type { UndefinedInitialDataOptions } from '@tanstack/react-query';
import {
  type DataTag,
  type DefinedInitialDataOptions,
  queryOptions,
  useQueries,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { type CustomProgram, type CustomShow } from '@tunarr/types';
import type { StrictOmit } from 'ts-essentials';
import { type ApiClient } from '../external/api.ts';
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

type CustomShowQueryOptions = StrictOmit<
  Partial<
    UndefinedInitialDataOptions<Awaited<ReturnType<ApiClient['getCustomShow']>>>
  >,
  'queryKey' | 'queryFn'
>;

export const customShowQuery = (
  apiClient: ApiClient,
  id: string,
  opts?: CustomShowQueryOptions,
) =>
  queryOptions({
    queryKey: ['custom-shows', id],
    queryFn: () => apiClient.getCustomShow({ params: { id } }),
    ...opts,
  });

export const customShowProgramsQuery = (apiClient: ApiClient, id: string) =>
  queryOptions({
    queryKey: ['custom-shows', id, 'programs'],
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

export function useCustomShowWithProgramming(
  id: string,
  opts?: CustomShowQueryOptions,
) {
  const apiClient = useTunarrApi();
  return useSuspenseQueries({
    queries: [
      {
        ...customShowQuery(apiClient, id, opts),
      },
      {
        ...customShowProgramsQuery(apiClient, id),
      },
    ],
  });
}
