import { Add, CloudDoneOutlined, CloudOff, Delete } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { isNonEmptyString, prettifySnakeCaseString } from '@tunarr/shared/util';
import type { LocalMediaSource } from '@tunarr/types';
import { MediaSourceContentType } from '@tunarr/types/schemas';
import { useDebounce } from '@uidotdev/usehooks';
import { isEmpty, isUndefined } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import type { MarkOptional, StrictOmit } from 'ts-essentials';
import { postApiMediaSourcesForeignstatus } from '../../../generated/sdk.gen.ts';
import {
  useCreateMediaSource,
  useUpdateMediaSource,
} from '../../../hooks/media-sources/mediaSourceHooks.ts';
import { RotatingLoopIcon } from '../../base/LoadingIcon.tsx';

type Props = {
  open: boolean;
  onClose: () => void;
  source?: LocalMediaSource;
};

type LocalMediaSourceForm = MarkOptional<
  StrictOmit<LocalMediaSource, 'libraries'>,
  'id'
>;

const emptyDefaults = () =>
  ({
    type: 'local',
    name: '',
    paths: [],
    mediaType: 'movies',
  }) satisfies LocalMediaSourceForm;

export const LocalMediaEditDialog = ({ onClose, open, source }: Props) => {
  const {
    control,
    watch,
    setValue,
    formState: { isDirty, isValid, errors },
    handleSubmit,
    register,
    getValues,
    trigger,
  } = useForm<LocalMediaSourceForm>({
    mode: 'onChange',
    defaultValues: source ?? emptyDefaults(),
    reValidateMode: 'onChange',
  });

  console.log(isDirty, isValid);

  const snackbar = useSnackbar();

  const paths = watch('paths');

  register('paths', {
    validate: (p) => {
      if (p.length === 0) {
        return 'Need at least one path';
      }
    },
  });

  const [currentPath, setCurrentPath] = useState<string>('');
  const [currentPathCheckLoading, setCurrentPathCheckLoading] = useState(false);
  const [currentPathIsHealthy, setCurrentPathIsHealthy] = useState(false);
  const throttledPath = useDebounce(currentPath, 500);

  const createMediaSourceMut = useCreateMediaSource();
  const updateMediaSourceMut = useUpdateMediaSource();

  const pathIsValid = useMemo(() => {
    if (currentPath.length === 0) {
      return false;
    }

    return currentPathIsHealthy;
  }, [currentPath.length, currentPathIsHealthy]);

  const onSubmitSuccess = useCallback(
    (values: LocalMediaSourceForm) => {
      if (values.id) {
        updateMediaSourceMut.mutate(
          {
            path: {
              id: values.id,
            },
            body: {
              type: 'local',
              id: values.id,
              mediaType: values.mediaType,
              name: values.name,
              paths: values.paths,
            },
          },
          {
            onSuccess: () => {
              onClose();
            },
          },
        );
      } else {
        createMediaSourceMut.mutate(
          {
            body: {
              type: 'local',
              mediaType: values.mediaType,
              name: values.name,
              paths: values.paths,
            },
          },
          {
            onSuccess: () => {
              onClose();
            },
          },
        );
      }
    },
    [createMediaSourceMut, onClose, updateMediaSourceMut],
  );

  const onSubmitError = useCallback(
    (err: FieldErrors<LocalMediaSourceForm>) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        message:
          'There was an error when submitting the form. Please see console logs for details.',
        variant: 'error',
      });
    },
    [snackbar],
  );

  useEffect(() => {
    const getStatus = async () => {
      setCurrentPathCheckLoading(true);
      try {
        const result = await postApiMediaSourcesForeignstatus({
          body: {
            type: 'local',
            paths: [throttledPath],
          },
          throwOnError: true,
        });
        setCurrentPathIsHealthy(result.data.healthy);
      } finally {
        setCurrentPathCheckLoading(false);
      }
    };

    getStatus().catch(console.error);
  }, [throttledPath]);

  const appendPath = useCallback(() => {
    setValue('paths', [...getValues('paths'), currentPath], {
      shouldDirty: true,
    });
    setCurrentPath('');
    trigger('paths').catch(console.error);
  }, [setValue, getValues, currentPath, trigger]);

  const removePath = useCallback(
    (path: string) => {
      setValue(
        'paths',
        getValues('paths').filter((p) => p !== path),
        { shouldDirty: true },
      );
      trigger('paths').catch(console.error);
    },
    [getValues, setValue, trigger],
  );

  const title = source ? `Editing "${source.name}"` : 'New Local Media Source';
  return (
    <Dialog open={open} onClose={onClose} fullWidth keepMounted={false}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box
          component="form"
          sx={{ mt: 1 }}
          onSubmit={handleSubmit(onSubmitSuccess, onSubmitError)}
        >
          <Stack spacing={2}>
            <Controller
              control={control}
              name="name"
              rules={{
                required: true,
                minLength: 1,
                pattern: {
                  value: /[A-z0-9_-]+/,
                  message:
                    'Name can only contain alphanumeric characters, dashes, and underscores',
                },
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label="Name"
                  fullWidth
                  {...field}
                  error={!isUndefined(error)}
                  helperText={
                    error && isNonEmptyString(error.message)
                      ? error.message
                      : 'Enter a name for your Local Media Source'
                  }
                />
              )}
            />
            <Controller
              control={control}
              name="mediaType"
              render={({ field, fieldState: { error } }) => (
                <FormControl fullWidth>
                  <InputLabel>Media Type</InputLabel>
                  <Select label="Media Type" {...field} error={!!error}>
                    {Object.values(MediaSourceContentType.enum).map((type) => (
                      <MenuItem value={type} key={type}>
                        {prettifySnakeCaseString(type)}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>
                    The type of media in the provided paths{' '}
                    {isNonEmptyString(error?.message) ? error.message : null}
                  </FormHelperText>
                </FormControl>
              )}
            />

            <Stack direction={'row'} spacing={1} alignItems="center">
              <TextField
                label="Path"
                fullWidth
                value={currentPath}
                onChange={(e) => setCurrentPath(e.target.value)}
                slotProps={{
                  input: {
                    spellCheck: false,
                    endAdornment: isEmpty(
                      currentPath,
                    ) ? null : currentPathCheckLoading ? (
                      <RotatingLoopIcon />
                    ) : !pathIsValid ? (
                      <CloudOff color="error" />
                    ) : (
                      <CloudDoneOutlined color="success" />
                    ),
                  },
                }}
              />
              <IconButton disabled={!pathIsValid} onClick={() => appendPath()}>
                <Add />{' '}
              </IconButton>
            </Stack>
            <Divider />
            <Box>
              <List sx={{ pl: 1, py: 0 }}>
                {paths.map((path) => (
                  <ListItem
                    disableGutters
                    key={path}
                    secondaryAction={
                      <IconButton
                        sx={{ p: 1 }}
                        onClick={() => removePath(path)}
                      >
                        <Delete />
                      </IconButton>
                    }
                  >
                    <ListItemText primary={path} />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => onClose()} autoFocus>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isDirty || !isValid || !isEmpty(errors)}
          type="submit"
          onClick={handleSubmit(onSubmitSuccess, onSubmitError)}
        >
          {source?.id ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
