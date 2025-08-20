import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChannelV2Mutation } from '../generated/@tanstack/react-query.gen.ts';

export const useCreateChannel = (
  opts?: ReturnType<typeof createChannelV2Mutation>,
) => {
  const queryClient = useQueryClient();

  return useMutation({
    ...createChannelV2Mutation(),
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
