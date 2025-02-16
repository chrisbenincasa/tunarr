import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type UpdateSystemSettingsRequest } from '@tunarr/types/api';
import { useApiQuery, useApiSuspenseQuery } from './useApiQuery.ts';
import { useTunarrApi } from './useTunarrApi.ts';

export const useSystemSettings = () =>
  useApiQuery({
    queryFn(api) {
      return api.getSystemSettings();
    },
    queryKey: ['system', 'settings'],
  });

export const useSystemSettingsSuspense = () =>
  useApiSuspenseQuery({
    queryFn(api) {
      return api.getSystemSettings();
    },
    queryKey: ['system', 'settings'],
  });

export const useUpdateSystemSettings = () => {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateSystemSettingsRequest) =>
      apiClient.updateSystemSettings(payload),
    onSuccess: (response) =>
      queryClient.setQueryData(['system', 'settings'], response),
  });
};

export const useSystemState = () =>
  useApiSuspenseQuery({
    queryFn(apiClient) {
      return apiClient.getSystemState();
    },
    queryKey: ['system', 'state'],
  });
