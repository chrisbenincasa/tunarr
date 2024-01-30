import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';
import { makeQueryOptions } from './useQueryHelpers.ts';

export const useFillerListsQuery = makeQueryOptions(['fillers'], () =>
  apiClient.getFillerLists(),
);

export const useFillerLists = () => useQuery(useFillerListsQuery);

export const fillerListQuery = (id: string) =>
  makeQueryOptions(['fillers', id], () =>
    apiClient.getFillerList({ params: { id } }),
  );

export const fillerListProgramsQuery = (id: string) =>
  makeQueryOptions(['fillers', id, 'programs'], () =>
    apiClient.getFillerListPrograms({ params: { id } }),
  );
