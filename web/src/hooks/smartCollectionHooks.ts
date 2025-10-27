import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  deleteApiSmartCollectionsByIdMutation,
  getApiSmartCollectionsByIdOptions,
  getApiSmartCollectionsOptions,
  postApiSmartCollectionsMutation,
  putApiSmartCollectionsByIdMutation,
} from '../generated/@tanstack/react-query.gen.ts';
import { invalidateTaggedQueries } from '../helpers/queryUtil.ts';

export const useSmartCollections = () => {
  return useSuspenseQuery({
    ...getApiSmartCollectionsOptions(),
  });
};

export const useSmartCollection = (id: string) => {
  return useSuspenseQuery({
    ...getApiSmartCollectionsByIdOptions({
      path: {
        id,
      },
    }),
  });
};

type MutationCallbacks = {
  onSuccess?: () => void;
};

export const useCreateSmartCollection = (callbacks?: MutationCallbacks) => {
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  return useMutation({
    ...postApiSmartCollectionsMutation(),
    onSuccess: (vars) => {
      snackbar.enqueueSnackbar({
        variant: 'success',
        message: `Successfully created Smart Collection "${vars.name}"`,
      });
      queryClient
        .invalidateQueries({
          predicate: invalidateTaggedQueries('Smart Collections'),
        })
        .catch(console.error)
        .finally(() => callbacks?.onSuccess?.());
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Error saving new Smart Collection. Check server logs and browser console for details.',
      });
    },
  });
};

export const useUpdateSmartCollection = (opts?: MutationCallbacks) => {
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  return useMutation({
    ...putApiSmartCollectionsByIdMutation(),
    onSuccess: (vars) => {
      snackbar.enqueueSnackbar({
        variant: 'success',
        message: `Successfully updated Smart Collection "${vars.name}"`,
      });
      queryClient
        .invalidateQueries({
          predicate: invalidateTaggedQueries('Smart Collections'),
        })
        .catch(console.error)
        .finally(() => opts?.onSuccess?.());
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Error updating Smart Collection. Check server logs and browser console for details.',
      });
    },
  });
};

export const useDeleteSmartCollection = () => {
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  return useMutation({
    ...deleteApiSmartCollectionsByIdMutation(),
    onSuccess: () => {
      snackbar.enqueueSnackbar({
        variant: 'success',
        message: `Successfully deletied Smart Collection`,
      });
      queryClient
        .invalidateQueries({
          predicate: invalidateTaggedQueries('Smart Collections'),
        })
        .catch(console.error);
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Error deleting Smart Collection. Check server logs and browser console for details.',
      });
    },
  });
};
