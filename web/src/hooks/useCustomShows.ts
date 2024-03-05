import { DataTag, useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';
import { ZodiosAliasReturnType } from '../types/index.ts';
import { makeQueryOptions } from './useQueryHelpers.ts';

export const customShowsQuery = makeQueryOptions(['custom-shows'], () =>
  apiClient.getCustomShows(),
);

export const useCustomShows = () => useQuery(customShowsQuery);

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
