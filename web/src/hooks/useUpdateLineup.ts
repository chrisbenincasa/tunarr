import { resetCurrentLineup } from '@/store/channelEditor/actions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateChannelProgrammingMutation } from '../generated/@tanstack/react-query.gen.ts';

export const useUpdateLineup = (
  opts?: ReturnType<typeof updateChannelProgrammingMutation>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...updateChannelProgrammingMutation(),
    onSuccess: async (...args) => {
      const [
        response,
        {
          path: { id: channelId },
        },
      ] = args;

      resetCurrentLineup(response);

      await queryClient.invalidateQueries({
        queryKey: ['channels', channelId],
        exact: false,
      });

      if (opts?.onSuccess) {
        await opts.onSuccess(...args);
      }
    },
    onError: async (...args) => {
      const error = args[0];
      console.error(error);
      if (opts?.onError) {
        await opts.onError(...args);
      }
    },
    onSettled: async (...args) => {
      if (opts?.onSettled) {
        await opts.onSettled(...args);
      }
    },
  });
};
