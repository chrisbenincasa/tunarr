import { useMutation, useQueryClient } from '@tanstack/react-query';
import { isEqual } from 'lodash-es';
import { useCallback } from 'react';
import {
  getProgramGroupingByIdQueryKey,
  getProgramByIdOptions,
  scanProgramMutation,
} from '../generated/@tanstack/react-query.gen.ts';

export const useScanNow = () => {
  const queryClient = useQueryClient();
  const clearQueryCache = useCallback(
    (programId: string) => {
      return queryClient.invalidateQueries({
        predicate: (key) => {
          return (
            isEqual(
              key,
              getProgramGroupingByIdQueryKey({ path: { id: programId } }),
            ) ||
            isEqual(key, getProgramByIdOptions({ path: { id: programId } }))
          );
        },
      });
    },
    [queryClient],
  );

  const scanMut = useMutation({
    ...scanProgramMutation(),
    onSuccess: (_, { path: { id } }) => {
      return clearQueryCache(id);
    },
  });

  return useCallback(
    (programId: string) => {
      scanMut.mutate({ path: { id: programId } });
      // setMoreMenuAnchorEl(null);
    },
    [scanMut],
  );
};
