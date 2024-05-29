import { useApiQuery } from './useApiQuery.ts';

export const useSystemSettings = () =>
  useApiQuery({
    queryFn(api) {
      return api.getSystemSettings();
    },
    queryKey: ['system', 'settings'],
  });
