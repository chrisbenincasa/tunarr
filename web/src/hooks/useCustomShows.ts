import {
  DataTag,
  DefinedInitialDataOptions,
  useQuery,
} from '@tanstack/react-query';
import { CustomShow } from '@tunarr/types';
import { apiClient } from '../external/api.ts';
import { ZodiosAliasReturnType } from '../types/index.ts';
import { makeQueryOptionsInitialData } from './useQueryHelpers.ts';

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
) => useQuery(customShowsQuery(initialData, opts ?? {}));

export const customShowQuery = (id: string) => ({
  queryKey: ['custom-shows', id] as DataTag<
    ['custom-shows', string],
    ZodiosAliasReturnType<'getCustomShow'>
  >,
  queryFn: () => apiClient.getCustomShow({ params: { id } }),
});

export const customShowProgramsQuery = (id: string) => ({
  queryKey: ['custom-shows', id, 'programs'] as DataTag<
    ['custom-shows', string, 'programs'],
    ZodiosAliasReturnType<'getCustomShowPrograms'>
  >,
  queryFn: () => apiClient.getCustomShowPrograms({ params: { id } }),
});
