import { DataTag, useQuery } from '@tanstack/react-query';
import { CustomShow } from '@tunarr/types';
import { apiClient } from '../external/api.ts';
import { ZodiosAliasReturnType } from '../types/index.ts';
import { makeQueryOptionsInitialData } from './useQueryHelpers.ts';

export const customShowsQuery = (initialData: CustomShow[] = []) =>
  makeQueryOptionsInitialData(
    ['custom-shows'],
    () => apiClient.getCustomShows(),
    initialData,
  );

export const useCustomShows = (initialData: CustomShow[] = []) =>
  useQuery(customShowsQuery(initialData));

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
