import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getApiSystemMigrationStateOptions,
  getApiSystemMigrationStateQueryKey,
  putApiSystemOnboardingMutation,
} from '../generated/@tanstack/react-query.gen.ts';

// A missing flag means the server predates onboarding, so treat it as done.
export const useOnboardingComplete = () => {
  const { data } = useQuery(getApiSystemMigrationStateOptions());
  return data?.onboardingComplete ?? true;
};

export const useSetOnboardingComplete = () => {
  const queryClient = useQueryClient();
  return useMutation({
    ...putApiSystemOnboardingMutation(),
    onSuccess: (data) => {
      queryClient.setQueryData(getApiSystemMigrationStateQueryKey(), data);
    },
  });
};
