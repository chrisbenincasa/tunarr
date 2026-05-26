import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  getSystemSettingsOptions,
  getSystemSettingsQueryKey,
  getSystemStateOptions,
  updateSystemSettingsMutation,
} from '../generated/@tanstack/react-query.gen.ts';

export const useSystemSettings = () =>
  useQuery({
    ...getSystemSettingsOptions(),
  });

export const useSystemSettingsSuspense = () =>
  useSuspenseQuery(getSystemSettingsOptions());

export const useUpdateSystemSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    ...updateSystemSettingsMutation(),
    onSuccess: (response) =>
      queryClient.setQueryData(getSystemSettingsQueryKey(), response),
  });
};

export const useSystemState = () =>
  useSuspenseQuery({
    ...getSystemStateOptions(),
  });
