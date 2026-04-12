import { Trans, useLingui } from '@lingui/react/macro';
import { Save } from '@mui/icons-material';
import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { isNonEmptyString } from '@tunarr/shared/util';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect } from 'react';
import type { FieldValues, SubmitErrorHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { getSmartCollectionOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { useUpdateSmartCollection } from '../../hooks/smartCollectionHooks.ts';

type Props = {
  id: string;
  onClose: () => void;
};

export const EditSmartCollectionDialog = (props: Props) => {
  const { t } = useLingui();
  const snackbar = useSnackbar();

  const {
    data: smartCollection,
    isLoading,
    isError,
  } = useQuery({
    ...getSmartCollectionOptions({
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
      message: t`Error updating Smart Collection. Check logs for details.`,
    });
  };

  const renderForm = () => {
    if (!smartCollection) {
      return;
    }

    return (
      <>
        <DialogTitle>
          <Trans>Editing Smart Collection "{smartCollection.name}"</Trans>
        </DialogTitle>
        <DialogContent>
          <Stack sx={{ mt: 1 }} gap={1}>
            <Controller
              control={control}
              name="name"
              rules={{ required: true, minLength: 1 }}
              render={({ field }) => (
                <TextField fullWidth label={t`Name`} {...field} />
              )}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={props.onClose}><Trans>Cancel</Trans></Button>
          <Button
            disabled={!isValid || !isDirty}
            startIcon={<Save />}
            variant="contained"
            onClick={handleSubmit(handleSave, handleSubmitError)}
          >
            <Trans>Save</Trans>
          </Button>
        </DialogActions>
      </>
    );
  };

  return (
    <>
      {isLoading && <LinearProgress />}
      {isError && (
        <Alert variant="filled" severity="error">
          <Trans>Failed to load Smart Collection</Trans>
        </Alert>
      )}
      {smartCollection && renderForm()}
    </>
  );
};
