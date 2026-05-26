import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChannelMutation } from '../generated/@tanstack/react-query.gen.ts';

export const useCreateChannel = (
  opts?: ReturnType<typeof createChannelMutation>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...createChannelMutation(),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['Channels'],
      });

      if (opts?.onSuccess) {
        opts?.onSuccess(...args);
      }
    },
    onError: (error, vars, ctx) => {
      console.error(error);

      if (opts?.onError) {
        opts?.onError(error, vars, ctx);
      }
    },
  });
};
