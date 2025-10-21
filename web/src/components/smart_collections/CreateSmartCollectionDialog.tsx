import { Save } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import { isEmpty } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import {
  useCreateSmartCollection,
  useSmartCollections,
  useUpdateSmartCollection,
} from '../../hooks/smartCollectionHooks.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  initialQuery: string | null | undefined;
};

type SmartCollectionForm = {
  name: string;
  id: string;
  query: string;
};

export const CreateSmartCollectionDialog = ({
  open,
  onClose,
  initialQuery,
}: Props) => {
  const { data: existingCollections } = useSmartCollections();
  const snackbar = useSnackbar();
  const {
    setValue,
    control,
    handleSubmit,
    formState: { isDirty, isValid },
    watch,
  } = useForm<SmartCollectionForm>({
    defaultValues: {
      name: '',
      query: '',
      id: 'new',
    },
  });

  useEffect(() => {
    if (isNonEmptyString(initialQuery)) {
      setValue('query', initialQuery);
    }
  }, [initialQuery, setValue]);

  const insertSmartCollection = useCreateSmartCollection({
    onSuccess: () => {
      onClose();
    },
  });

  const updateSmartCollection = useUpdateSmartCollection({
    onSuccess: () => {
      onClose();
    },
  });

  const existingId = watch('id');

  const saveSmartCollection = useCallback(
    (values: SmartCollectionForm) => {
      if (values.id === 'new') {
        insertSmartCollection.mutate({
          body: {
            name: values.name,
            query: values.query,
          },
          throwOnError: true,
        });
      } else {
        updateSmartCollection.mutate({
          path: {
            id: values.id,
          },
          body: {
            query: values.query,
          },
        });
      }
    },
    [insertSmartCollection, updateSmartCollection],
  );

  const handleError = useCallback(
    (errors: FieldErrors) => {
      console.error(errors);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message:
          'Error saving new Smart Collection. Check server logs and browser console for details.',
      });
    },
    [snackbar],
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Save Smart Collection</DialogTitle>
      <DialogContent>
        <Stack gap={2} sx={{ pt: 1 }}>
          <Controller
            control={control}
            name="id"
            render={({ field }) => (
              <FormControl>
                <Select
                  disabled={existingCollections.length === 0}
                  {...field}
                  value={field.value ? field.value : 'new'}
                >
                  {existingCollections.map((coll) => (
                    <MenuItem key={coll.uuid} value={coll.uuid}>
                      {coll.name}
                    </MenuItem>
                  ))}
                  <MenuItem value="new">
                    Save as new collection&hellip;
                  </MenuItem>
                </Select>
                <FormHelperText>
                  {field.value === 'new'
                    ? 'Creates a new collection'
                    : `Existing query: ${existingCollections.find((coll) => coll.uuid === field.value)?.query ?? ''}`}
                </FormHelperText>
              </FormControl>
            )}
          />
          {isEmpty(existingId) ||
            (existingId === 'new' && (
              <Controller
                name="name"
                control={control}
                rules={{
                  validate: {
                    valid: (v, form) =>
                      isNonEmptyString(form.id) ? undefined : !isEmpty(v),
                  },
                }}
                render={({ field }) => <TextField label="Name" {...field} />}
              />
            ))}
          <Controller
            name="query"
            control={control}
            rules={{ required: true, minLength: 1 }}
            render={({ field }) => (
              <TextField disabled label="Query" {...field} />
            )}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          variant="contained"
          disabled={!isDirty || !isValid}
          startIcon={<Save />}
          onClick={handleSubmit(saveSmartCollection, handleError)}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};
