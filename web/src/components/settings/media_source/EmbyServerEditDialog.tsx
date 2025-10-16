import { isNonEmptyString, isValidUrlWithError, toggle } from '@/helpers/util';

import { RotatingLoopIcon } from '@/components/base/LoadingIcon.tsx';
import { useMediaSourceBackendStatus } from '@/hooks/media-sources/useMediaSourceBackendStatus';
import {
  CloudDoneOutlined,
  CloudOff,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
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
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type EmbyServerSettings } from '@tunarr/types';
import { isEmpty, isUndefined } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useEffect, useState, type FormEvent } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import type { StrictOmit } from 'ts-essentials';
import { type MarkOptional } from 'ts-essentials';
import { useDebounceCallback, useDebounceValue } from 'usehooks-ts';
import {
  postApiMediaSources,
  putApiMediaSourcesById,
} from '../../../generated/sdk.gen.ts';
import { invalidateTaggedQueries } from '../../../helpers/queryUtil.ts';
import { embyLogin } from '../../../hooks/emby/useEmbyLogin.ts';
import { EditPathReplacementsForm } from './EditPathReplacementsForm.tsx';

type Props = {
  open: boolean;
  onClose: () => void;
  server?: EmbyServerSettings;
};

export type EmbyServerSettingsForm = MarkOptional<
  StrictOmit<EmbyServerSettings, 'libraries'>,
  'id'
> & {
  password?: string;
};

const emptyDefaults: EmbyServerSettingsForm = {
  type: 'emby',
  uri: '',
  name: '',
  accessToken: '',
  username: '',
  password: '',
  userId: '',
  pathReplacements: [],
};

export function EmbyServerEditDialog({ open, onClose, server }: Props) {
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

  const [showAccessToken, setShowAccessToken] = useState(false);

  const title = server ? `Editing "${server.name}"` : 'New Emby Media Source';

  const handleClose = () => {
    setShowAccessToken(false);
    onClose();
  };

  const form = useForm<EmbyServerSettingsForm>({
    mode: 'onChange',
    defaultValues: server ?? emptyDefaults,
  });
  const {
    control,
    watch,
    reset,
    formState: { isDirty, isValid, defaultValues, errors },
    handleSubmit,
    setError,
    clearErrors,
    getValues,
  } = form;

  useEffect(() => {
    if (open) {
      reset(server ?? emptyDefaults);
    }
  }, [reset, open, server]);

  // These are updated in a watch callback, so we debounce them
  // along with the details we use to check server status. Otherwise
  // setting the error will cause us to check server status on every
  // keystroke due to re-renders
  const debounceSetError = useDebounceCallback(setError);
  const debounceClearError = useDebounceCallback(clearErrors);

  const updateSourceMutation = useMutation({
    mutationFn: async (newOrUpdatedServer: EmbyServerSettingsForm) => {
      if (isNonEmptyString(newOrUpdatedServer.id)) {
        await putApiMediaSourcesById({
          body: { ...newOrUpdatedServer, id: newOrUpdatedServer.id },
          path: { id: newOrUpdatedServer.id },
        });
        return { id: newOrUpdatedServer.id };
      } else {
        return postApiMediaSources({
          body: newOrUpdatedServer,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Media Source'),
      });
      handleClose();
    },
  });

  const showErrorSnack = (e: unknown) => {
    snackbar.enqueueSnackbar({
      variant: 'error',
      message:
        'Error saving new Emby server. See browser console and server logs for details',
    });
    console.error(e);
  };

  const onSubmit = async (e: FormEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const { accessToken, username, password, uri } = getValues();

    if (isNonEmptyString(accessToken)) {
      void handleSubmit(
        (data) =>
          updateSourceMutation.mutate({
            ...data,
            userId: null,
            username: null,
          }),
        showErrorSnack,
      )(e);
    } else if (isNonEmptyString(username) && isNonEmptyString(password)) {
      try {
        const result = await embyLogin({
          username,
          password,
          uri,
        });

        if (
          isNonEmptyString(result.accessToken) &&
          isNonEmptyString(result.userId)
        ) {
          void handleSubmit(
            (data) =>
              updateSourceMutation.mutate({
                ...data,
                accessToken: result.accessToken!,
                userId: result.userId!,
              }),
            showErrorSnack,
          )(e);
        } else {
          // Pop snackbar
        }
      } catch (e) {
        showErrorSnack(e);
      }
    }
  };

  const [showPassword, setShowPassword] = useState(false);

  const [serverStatusDetails, updateServerStatusDetails] = useDebounceValue(
    {
      id: server?.id && !isDirty ? server.id : undefined,
      accessToken: defaultValues?.accessToken ?? '',
      uri: defaultValues?.uri ?? '',
    },
    1000,
    {
      equalityFn: (left, right) => {
        return (
          left.id === right.id &&
          left.uri === right.uri &&
          left.accessToken === right.accessToken
        );
      },
    },
  );

  // This probably isn't the best way to do this...but it was the only
  // way to get it working without infinite re-renders. Idea here is:
  // Update the debounced value if relevant details change. Do not rely
  // on the debounced value itself in this effect, because then we'll
  // just update every time. This watch will fire off every time accessToken
  // or URI changes, but the status query will only fire every 500ms
  useEffect(() => {
    const sub = watch((value, { name }) => {
      if (
        isNonEmptyString(value.accessToken) ||
        (isNonEmptyString(value.username) && isNonEmptyString(value.password))
      ) {
        debounceClearError('root.auth');
      } else {
        debounceSetError('root.auth', {
          message: 'Must provide either access token or username/password',
        });
      }

      if (name === 'uri' || name === 'accessToken') {
        updateServerStatusDetails({
          id: server?.id && !isDirty ? server.id : undefined,
          accessToken: value.accessToken ?? '',
          uri: value.uri ?? '',
        });
      }
    });

    return () => sub.unsubscribe();
  }, [
    watch,
    updateServerStatusDetails,
    server?.id,
    isDirty,
    debounceClearError,
    debounceSetError,
    errors,
  ]);

  const { data: serverStatus, isLoading: serverStatusLoading } =
    useMediaSourceBackendStatus({ ...serverStatusDetails, type: 'emby' }, open);

  // TODO: Block creation if an existing server with the same URL/name
  // already exist
  return (
    <Dialog open={open} fullWidth keepMounted={false} onClose={() => onClose()}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box component="form">
          <Stack sx={{ py: 2 }} spacing={2}>
            <Controller
              control={control}
              name="uri"
              rules={{
                validate: {
                  url: (value) => {
                    // TODO: dedupe this function
                    const err = isValidUrlWithError(value);
                    if (isUndefined(err)) {
                      return undefined;
                    }

                    switch (err) {
                      case 'empty':
                        return 'Cannot be empty';
                      case 'not_parseable':
                        return 'Not a valid URL';
                      case 'wrong_protocol':
                        return 'Protocol must be HTTP or HTTPS';
                    }
                  },
                },
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label="URL"
                  fullWidth
                  {...field}
                  error={
                    !isUndefined(error) ||
                    (!isUndefined(serverStatus) && !serverStatus.healthy)
                  }
                  helperText={
                    error?.message ? (
                      <span>{error.message}</span>
                    ) : !isUndefined(serverStatus) &&
                      !serverStatus.healthy &&
                      isNonEmptyString(field.value) ? (
                      <>
                        <span>Server is unreachable</span>
                        <br />
                      </>
                    ) : null
                  }
                  InputProps={{
                    endAdornment: serverStatusLoading ? (
                      <RotatingLoopIcon />
                    ) : !isUndefined(serverStatus) && serverStatus.healthy ? (
                      <CloudDoneOutlined color="success" />
                    ) : (
                      <CloudOff color="error" />
                    ),
                  }}
                />
              )}
            />
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
                      : 'Enter a name for your Emby Server'
                  }
                />
              )}
            />
            <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <Controller
                control={control}
                name="username"
                rules={{
                  required: false,
                  minLength: 1,
                }}
                render={({ field, fieldState: { error } }) => (
                  <FormControl sx={{ flex: 1 }} variant="outlined">
                    <InputLabel htmlFor="emby-username">Username </InputLabel>
                    <OutlinedInput
                      id="emby-username"
                      type="text"
                      error={!isUndefined(error)}
                      label="Access Token"
                      {...field}
                    />
                    <FormHelperText>
                      {error && isNonEmptyString(error.message) && (
                        <span>{error.message}</span>
                      )}
                    </FormHelperText>
                  </FormControl>
                )}
              />
              <Controller
                control={control}
                name="password"
                rules={{
                  required: false,
                  minLength: 1,
                }}
                render={({ field, fieldState: { error } }) => (
                  <FormControl sx={{ flex: 1 }} variant="outlined">
                    <InputLabel htmlFor="emby-password">Password </InputLabel>
                    <OutlinedInput
                      id="emby-password"
                      type={showPassword ? 'text' : 'password'}
                      error={!isUndefined(error)}
                      endAdornment={
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle access token visibility"
                            onClick={() => setShowPassword(toggle)}
                            edge="end"
                          >
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      }
                      label="Access Token"
                      {...field}
                    />
                    <FormHelperText>
                      {error && isNonEmptyString(error.message) && (
                        <>
                          <span>{error.message}</span>
                          <br />
                        </>
                      )}
                    </FormHelperText>
                  </FormControl>
                )}
              />
              <FormHelperText sx={{ ml: '14px', mt: -1, flexBasis: '100%' }}>
                Enter your Emby password to generate a new access token.
              </FormHelperText>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Divider sx={{ flex: 1 }} />
              <Typography variant="caption">OR</Typography>
              <Divider sx={{ flex: 1 }} />
            </Box>
            <Controller
              control={control}
              name="accessToken"
              rules={
                {
                  // required: true,
                  // minLength: 1,
                }
              }
              render={({ field, fieldState: { error } }) => (
                <FormControl
                  sx={{ m: 1 }}
                  fullWidth
                  variant="outlined"
                  // disabled={
                  //   // isNonEmptyString(username) && isNonEmptyString(password)
                  // }
                >
                  <InputLabel htmlFor="access-token">Access Token </InputLabel>
                  <OutlinedInput
                    id="access-token"
                    type={showAccessToken ? 'text' : 'password'}
                    error={!isUndefined(error)}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label="toggle access token visibility"
                          onClick={() => setShowAccessToken(toggle)}
                          edge="end"
                        >
                          {showAccessToken ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label="Access Token"
                    {...field}
                  />
                  <FormHelperText>
                    <>
                      {error && isNonEmptyString(error.message) && (
                        <>
                          <span>{error.message}</span>
                          <br />
                        </>
                      )}
                      <span>
                        Manually add an access token from your Emby server
                      </span>
                    </>
                  </FormHelperText>
                </FormControl>
              )}
            />
            <Divider />
            <Box>
              <FormProvider {...form}>
                <EditPathReplacementsForm />
              </FormProvider>
            </Box>
            <Divider />
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => handleClose()} autoFocus>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={
            !isDirty ||
            !isValid ||
            !isEmpty(errors) ||
            serverStatus?.healthy === false
          }
          type="submit"
          onClick={onSubmit}
        >
          {server?.id ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
