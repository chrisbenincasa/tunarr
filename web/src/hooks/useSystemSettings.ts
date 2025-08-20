import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import {
  getApiSystemSettingsOptions,
  getApiSystemSettingsQueryKey,
  getApiSystemStateOptions,
  putApiSystemSettingsMutation,
} from '../generated/@tanstack/react-query.gen.ts';

export const useSystemSettings = () =>
  useQuery({
    ...getApiSystemSettingsOptions(),
  });

export const useSystemSettingsSuspense = () =>
  useSuspenseQuery(getApiSystemSettingsOptions());

export const useUpdateSystemSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    ...putApiSystemSettingsMutation(),
    onSuccess: (response) =>
      queryClient.setQueryData(getApiSystemSettingsQueryKey(), response),
  });
};

export const useSystemState = () =>
  useSuspenseQuery({
    ...getApiSystemStateOptions(),
  });
