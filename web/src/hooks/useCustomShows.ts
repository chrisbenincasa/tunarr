import type { UseQueryOptions } from '@tanstack/react-query';
import { useQueries, useSuspenseQuery } from '@tanstack/react-query';
import { type CustomShow } from '@tunarr/types';
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

export function useCustomShowWithProgramming<CustomShowSelectT = CustomShow>(
  id: string,
  opts?: OverridableCustomShowByIdQueryOptions<CustomShowSelectT>,
) {
  return useQueries({
    queries: [customShowQuery(id, opts), customShowProgramsQuery(id)],
  });
}
