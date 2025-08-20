import type { UseQueryOptions } from '@tanstack/react-query';
import {
  type DataTag,
  type DefinedInitialDataOptions,
  useQueries,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { type CustomProgram, type CustomShow } from '@tunarr/types';
import type { StrictOmit } from 'ts-essentials';
import type {
  getApiCustomShowsByIdProgramsQueryKey,
  getApiCustomShowsQueryKey,
} from '../generated/@tanstack/react-query.gen.ts';
import {
  getApiCustomShowsByIdOptions,
  getApiCustomShowsByIdProgramsOptions,
  getApiCustomShowsOptions,
} from '../generated/@tanstack/react-query.gen.ts';

export type CustomShowsQueryOpts<TData = CustomShow[]> = Omit<
  DefinedInitialDataOptions<
    CustomShow[],
    Error,
    TData,
    DataTag<['custom-shows'], CustomShow[]>
  >,
  'queryKey' | 'queryFn' | 'initialData'
>;

type OverridableCustomShowQueryOptions<TOut> = StrictOmit<
  UseQueryOptions<
    CustomShow[],
    Error,
    TOut,
    ReturnType<typeof getApiCustomShowsQueryKey>
  >,
  'queryKey' | 'queryFn'
>;

export const customShowsQuery = <TOut = CustomShow[]>(
  opts?: OverridableCustomShowQueryOptions<TOut>,
) =>
  ({ ...getApiCustomShowsOptions(), ...(opts ?? {}) }) as UseQueryOptions<
    CustomShow[],
    Error,
    TOut,
    ReturnType<typeof getApiCustomShowsQueryKey>
  >;

export const useCustomShows = <TOut = CustomShow[]>(
  opts?: Partial<
    StrictOmit<
      UseQueryOptions<
        CustomShow[],
        Error,
        TOut,
        ReturnType<typeof getApiCustomShowsQueryKey>
      >,
      'queryKey' | 'queryFn'
    >
  >,
) => {
  return useSuspenseQuery(customShowsQuery(opts));
};

type OverridableCustomShowByIdQueryOptions<TOut> = StrictOmit<
  UseQueryOptions<
    CustomShow,
    Error,
    TOut,
    ReturnType<typeof getApiCustomShowsByIdProgramsQueryKey>
  >,
  'queryKey' | 'queryFn'
>;

export const customShowQuery = <TOut = CustomShow>(
  id: string,
  opts?: OverridableCustomShowByIdQueryOptions<TOut>,
) => ({ ...getApiCustomShowsByIdOptions({ path: { id } }), ...(opts ?? {}) });

export const customShowProgramsQuery = (id: string) =>
  getApiCustomShowsByIdProgramsOptions({ path: { id } });

// Tried to do a clever overload here but it's easier to just blow out the  method
// and get the rid type inference...
export function useCustomShowWithInitialData(
  id: string,
  enabled: boolean,
  initialData: { customShow: CustomShow; programs: CustomProgram[] },
) {
  return useQueries({
    queries: [
      customShowQuery(id, { enabled, initialData: initialData?.customShow }),
      {
        ...customShowProgramsQuery(id),
        enabled: enabled,
        initialData: initialData?.programs,
      },
    ],
  });
}

export function useCustomShowWithProgramming<CustomShowSelectT = CustomShow>(
  id: string,
  opts?: OverridableCustomShowByIdQueryOptions<CustomShowSelectT>,
) {
  return useSuspenseQueries({
    queries: [customShowQuery(id, opts), customShowProgramsQuery(id)],
  });
}
