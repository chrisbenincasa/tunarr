import {
  queryOptions,
  useSuspenseQueries,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  getFillerListOptions,
  getFillerListProgramsOptions,
  getFillerListsOptions,
} from '../generated/@tanstack/react-query.gen.ts';
import useStore from '../store/index.ts';

export const fillerListsQuery = () =>
  queryOptions({
    ...getFillerListsOptions(),
    // queryKey: ['fillers'],
    // queryFn: () => apiClient.getFillerLists(),
    staleTime: 1000 * 60 * 5,
  });

export const useFillerLists = (
  opts?: Partial<ReturnType<typeof getFillerListsOptions>>,
) => {
  return useSuspenseQuery({ ...fillerListsQuery(), ...opts });
};

export const fillerListQuery = (id: string) =>
  getFillerListOptions({ path: { id } });
// makeQueryOptions(['fillers', id], () =>
//   apiClient.getFillerList({ params: { id } }),
// );

export const useCurrentFillerList = () =>
  useStore((s) => s.fillerListEditor.currentEntity);

export const fillerListProgramsQuery = (id: string) =>
  getFillerListProgramsOptions({ path: { id } });

// Tried to do a clever overload here but it's easier to just blow out the  method
// and get the rid type inference...
export function useFillerListWithProgramming(id: string) {
  return useSuspenseQueries({
    queries: [
      {
        ...fillerListQuery(id),
      },
      {
        ...fillerListProgramsQuery(id),
      },
    ],
  });
}
