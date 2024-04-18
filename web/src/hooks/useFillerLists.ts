import { useQuery } from '@tanstack/react-query';
import useStore from '../store/index.ts';
import { makeQueryOptions } from './useQueryHelpers.ts';
import { ApiClient } from '../external/api.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const fillerListsQuery = (apiClient: ApiClient) =>
  makeQueryOptions(['fillers'], () => apiClient.getFillerLists());

export const useFillerLists = () => {
  return useQuery(fillerListsQuery(useTunarrApi()));
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
