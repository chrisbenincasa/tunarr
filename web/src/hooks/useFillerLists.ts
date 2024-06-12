import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { ApiClient } from '../external/api.ts';
import useStore from '../store/index.ts';
import { makeQueryOptions } from './useQueryHelpers.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const fillerListsQuery = (apiClient: ApiClient) =>
  makeQueryOptions(['fillers'], () => apiClient.getFillerLists());

export const useFillerLists = () => {
  return useSuspenseQuery(fillerListsQuery(useTunarrApi()));
};

export const fillerListQuery = (apiClient: ApiClient, id: string) =>
  makeQueryOptions(['fillers', id], () =>
    apiClient.getFillerList({ params: { id } }),
  );

export const useCurrentFillerList = () =>
  useStore((s) => s.fillerListEditor.currentEntity);

export const fillerListProgramsQuery = (apiClient: ApiClient, id: string) =>
  makeQueryOptions(['fillers', id, 'programs'], () =>
    apiClient.getFillerListPrograms({ params: { id } }),
  );

// Tried to do a clever overload here but it's easier to just blow out the  method
// and get the rid type inference...
export function useFillerListWithProgramming(apiClient: ApiClient, id: string) {
  return useSuspenseQueries({
    queries: [
      {
        ...fillerListQuery(apiClient, id),
      },
      {
        ...fillerListProgramsQuery(apiClient, id),
      },
    ],
  });
}
