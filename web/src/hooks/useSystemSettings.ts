import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiQuery } from './useApiQuery.ts';
import { useTunarrApi } from './useTunarrApi.ts';
import { LogLevel } from '@tunarr/types';

export const useSystemSettings = () =>
  useApiQuery({
    queryFn(api) {
      return api.getSystemSettings();
    },
    queryKey: ['system', 'settings'],
  });

type UpdateSystemSettingsArgs = {
  logLevel?: LogLevel;
};

export const useUpdateSystemSettings = () => {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSystemSettingsArgs) =>
      apiClient.updateSystemSettings(payload),
    onSuccess: (response) =>
      queryClient.setQueryData(['system', 'settings'], response),
  });
};
