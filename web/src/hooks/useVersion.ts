import { useApiQuery } from './useApiQuery.ts';

export const useVersion = () => {
  return useApiQuery({
    queryKey: ['version'],
    queryFn: (apiClient) => {
      return apiClient.getServerVersions();
    },
    staleTime: 30 * 1000,
  });
};
