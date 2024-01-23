import { DataTag, useQuery } from '@tanstack/react-query';
import { ApiOf } from '@zodios/core';
import { ZodiosAliases } from '@zodios/core/lib/zodios.types';
import { apiClient } from '../external/api.ts';

type ApiType = ApiOf<typeof apiClient>;
type RT<T extends keyof ZodiosAliases<ApiType>> = Awaited<
  ReturnType<ZodiosAliases<ApiType>[T]>
>;
// type Tag<Arr extends ReadonlyArray<unknown>, T extends keyof ZodiosAliases<ApiType>> = DataTag<Arr, RT<T>>

export const useCustomShowsQuery = {
  queryKey: ['custom-shows'] as DataTag<['custom-shows'], RT<'getCustomShows'>>,
  queryFn: () => apiClient.getCustomShows(),
};

export const useCustomShows = () => useQuery(useCustomShowsQuery);

export const customShowQuery = (id: string) => ({
  queryKey: ['custom-shows', id] as DataTag<
    ['custom-shows', string],
    Awaited<ReturnType<(typeof apiClient)['getCustomShow']>>
  >,
  queryFn: () => apiClient.getCustomShow({ params: { id } }),
});

export const customShowProgramsQuery = (id: string) => ({
  queryKey: ['custom-shows', id, 'programs'] as DataTag<
    ['custom-shows', string, 'programs'],
    RT<'getCustomShowPrograms'>
  >,
  queryFn: () => apiClient.getCustomShowPrograms({ params: { id } }),
});
