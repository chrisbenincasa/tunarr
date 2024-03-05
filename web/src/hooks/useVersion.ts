import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../external/api.ts';

export const useVersion = () =>
  useQuery({
    queryKey: ['version'],
    queryFn: () => {
      return apiClient.getServerVersions();
    },
    staleTime: 30 * 1000,
  });
