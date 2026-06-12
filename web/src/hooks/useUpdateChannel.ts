import { useMutation, useQueryClient } from '@tanstack/react-query';
import { putApiChannelsByIdMutation } from '../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../helpers/queryUtil.ts';

export const useUpdateChannel = (
  opts?: ReturnType<typeof putApiChannelsByIdMutation>,
) => {
  const queryClient = useQueryClient();

  const updateChannel = useMutation({
    ...putApiChannelsByIdMutation(),
    onSuccess: async (...args) => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Channels'),
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
