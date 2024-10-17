import { useApiQuery } from './useApiQuery';

export const useSystemHealthChecks = () => {
  return useApiQuery({
    queryKey: ['system', 'health'],
    queryFn: (api) => api.getSystemHealth(),
  });
};
