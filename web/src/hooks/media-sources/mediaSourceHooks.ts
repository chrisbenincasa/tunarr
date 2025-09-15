import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  postApiMediaSourcesMutation,
  putApiMediaSourcesByIdMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';

type Callbacks = {
  onSuccess?: () => void;
};

export const useUpdateMediaSource = (callbacks?: Callbacks) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...putApiMediaSourcesByIdMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
      callbacks?.onSuccess?.();
    },
    // TODO: add on Error
  });
};

export const useCreateMediaSource = (callbacks?: Callbacks) => {
  const queryClient = useQueryClient();
  return useMutation({
    ...postApiMediaSourcesMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
      callbacks?.onSuccess?.();
    },
  });
};
