import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { useSnackbar } from 'notistack';
import {
  getApiMediaSourcesByMediaSourceIdOptions,
  postApiMediaSourcesMutation,
  putApiMediaSourcesByIdMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';

type Callbacks = {
  onSuccess?: () => void;
  onError?: (err: AxiosError<string | Error, unknown>) => void;
};

export const useMediaSource = (mediaSourceId: string) => {
  return useSuspenseQuery({
    ...getApiMediaSourcesByMediaSourceIdOptions({
      path: {
        mediaSourceId,
      },
    }),
  });
};

export const useUpdateMediaSource = (callbacks?: Callbacks) => {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  return useMutation({
    ...putApiMediaSourcesByIdMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
      callbacks?.onSuccess?.();
    },
    onError: (err) => {
      snackbar.enqueueSnackbar({
        message:
          'Error while updating media source. Please check browser and server logs for details.',
        variant: 'error',
      });
      console.error(err);
      callbacks?.onError?.(err);
    },
  });
};

export const useCreateMediaSource = (callbacks?: Callbacks) => {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();
  return useMutation({
    ...postApiMediaSourcesMutation(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
      callbacks?.onSuccess?.();
    },
    onError(error) {
      snackbar.enqueueSnackbar({
        message:
          'Error while creating media source. Please check browser and server logs for details.',
        variant: 'error',
      });
      console.error(error);
      callbacks?.onError?.(error);
    },
  });
};
