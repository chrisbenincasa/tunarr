import { Save } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { isNonEmptyString } from '@tunarr/shared/util';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect } from 'react';
import type { FieldValues, SubmitErrorHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { getApiSmartCollectionsByIdOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { useUpdateSmartCollection } from '../../hooks/smartCollectionHooks.ts';
import type { CommonDialogProps } from '../../types/CommonDialogProps.ts';

type Props = CommonDialogProps & {
  id: string;
};

export const EditSmartCollectionDialog = (props: Props) => {
  const snackbar = useSnackbar();

  const {
    data: smartCollection,
    isLoading,
    isError,
  } = useQuery({
    ...getApiSmartCollectionsByIdOptions({
      path: {
        id: props.id,
      },
    }),
    enabled: isNonEmptyString(props.id),
  });

  const {
    reset,
    control,
    formState: { isValid, isDirty },
    handleSubmit,
  } = useForm<{ name: string }>({
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (smartCollection?.name) {
      reset({
        name: smartCollection.name,
      });
    }
  }, [reset, smartCollection?.name]);

  const updateSmartCollection = useUpdateSmartCollection({
    onSuccess: () => {
      props.onClose();
    },
  });

  const handleSave = useCallback(
    (values: { name: string }) => {
      updateSmartCollection.mutate({
        path: {
          id: props.id,
        },
        body: {
          name: values.name,
        },
      });
    },
    [props.id, updateSmartCollection],
  );

  const handleSubmitError: SubmitErrorHandler<FieldValues> = (err) => {
    console.error(err);
    snackbar.enqueueSnackbar({
      variant: 'error',
      message: 'Error updating Smart Collection. Check logs for details.',
    });
  };

  const renderForm = () => {
    if (!smartCollection) {
      return;
    }

    return (
      <>
        <DialogTitle>Editing "{smartCollection.name}"</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Controller
              control={control}
              name="name"
              rules={{ required: true, minLength: 1 }}
              render={({ field }) => <TextField label="Name" {...field} />}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={props.onClose}>Cancel</Button>
          <Button
            disabled={!isValid || !isDirty}
            startIcon={<Save />}
            variant="contained"
            onClick={handleSubmit(handleSave, handleSubmitError)}
          >
            Save
          </Button>
        </DialogActions>
      </>
    );
  };

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth>
      {isLoading && <LinearProgress />}
      {isError && (
        <Alert variant="filled" severity="error">
          Failed to load Smart Collection
        </Alert>
      )}
      {smartCollection && renderForm()}
    </Dialog>
  );
};
