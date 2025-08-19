import { useMutation, useQueryClient } from '@tanstack/react-query';
import { putApiChannelsByIdMutation } from '../generated/@tanstack/react-query.gen.ts';

export const useUpdateChannel = (
  opts?: ReturnType<typeof putApiChannelsByIdMutation>,
) => {
  const queryClient = useQueryClient();

  const updateChannel = useMutation({
    ...putApiChannelsByIdMutation(),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        exact: false,
        queryKey: ['channels'],
      });

      updateChannel.reset();

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

  return updateChannel;
};
