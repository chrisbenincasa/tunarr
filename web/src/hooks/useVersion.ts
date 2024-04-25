import { UseQueryOptions } from '@tanstack/react-query';
import { useApiQuery } from './useApiQuery.ts';
import { VersionApiResponse } from '@tunarr/types/api';

export const useVersion = (
  extraOpts: Omit<
    UseQueryOptions<VersionApiResponse>,
    'queryKey' | 'queryFn'
  > = {},
) => {
  return useApiQuery({
    queryKey: ['version'],
    queryFn: (apiClient) => {
      return apiClient.getServerVersions();
    },
    ...extraOpts,
    staleTime: extraOpts.staleTime ?? 30 * 1000,
  });
};
