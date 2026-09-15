import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { invalidateTaggedQueries } from '../helpers/queryUtil.ts';
import { postApiProgramsByIdScanMutation } from '../generated/@tanstack/react-query.gen.ts';

export const useScanNow = () => {
  const queryClient = useQueryClient();
  // A scan rewrites metadata for the program and, for a grouping, its
  // children -- so the whole Programs category is stale, not one entry.
  const clearQueryCache = useCallback(() => {
    return queryClient.invalidateQueries({
      predicate: invalidateTaggedQueries('Programs'),
    });
  }, [queryClient]);

  const scanMut = useMutation({
    ...postApiProgramsByIdScanMutation(),
    onSuccess: () => {
      return clearQueryCache();
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
