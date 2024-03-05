import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';
import { makeQueryOptions } from './useQueryHelpers.ts';
import useStore from '../store/index.ts';

export const fillerListsQuery = makeQueryOptions(['fillers'], () =>
  apiClient.getFillerLists(),
);

export const useFillerLists = () => useQuery(fillerListsQuery);

export const fillerListQuery = (id: string) =>
  makeQueryOptions(['fillers', id], () =>
    apiClient.getFillerList({ params: { id } }),
  );

export const useCurrentFillerList = () =>
  useStore((s) => s.fillerListEditor.currentEntity);

export const fillerListProgramsQuery = (id: string) =>
  makeQueryOptions(['fillers', id, 'programs'], () =>
    apiClient.getFillerListPrograms({ params: { id } }),
  );
