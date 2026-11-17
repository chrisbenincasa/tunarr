import { clearChannelSchedule } from '@/store/channelEditor/actions';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteChannelScheduleMutation } from '../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../helpers/queryUtil.ts';

export const useDeleteChannelSchedule = (
  opts?: ReturnType<typeof deleteChannelScheduleMutation>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...deleteChannelScheduleMutation(),
    onSuccess: async (...args) => {
      clearChannelSchedule();

      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Channels'),
      });

      if (opts?.onSuccess) {
        await opts.onSuccess(...args);
      }
    },
    onError: opts?.onError,
  });
};
