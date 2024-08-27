import { isNonEmptyString, isValidUrlWithError, toggle } from '@/helpers/util';
import { useTunarrApi } from '@/hooks/useTunarrApi';

import { RotatingLoopIcon } from '@/components/base/LoadingIcon.tsx';
import { jellyfinLogin } from '@/hooks/jellyfin/useJellyfinLogin.ts';
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
import { JellyfinServerSettings, PlexServerSettings } from '@tunarr/types';
import { isEmpty, isUndefined } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { FormEvent, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MarkOptional } from 'ts-essentials';
import { useDebounceCallback, useDebounceValue } from 'usehooks-ts';

type Props = {
  open: boolean;
  onClose: () => void;
  server?: JellyfinServerSettings;
};

type PlexServerSettingsForm = MarkOptional<
  Omit<PlexServerSettings, 'clientIdentifier'>,
  'id'
>;

export type JellyfinServerSettingsForm = MarkOptional<
  JellyfinServerSettings,
  'id'
> & {
  username?: string;
  password?: string;
};

export type FormType = {
  plex?: PlexServerSettingsForm;
  jellyfin?: JellyfinServerSettingsForm;
};

const emptyDefaults: JellyfinServerSettingsForm = {
  type: 'jellyfin',
  uri: '',
  name: '',
  accessToken: '',
  username: '',
  password: '',
};

export function JellyfinServerEditDialog({ open, onClose, server }: Props) {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

  const [showAccessToken, setShowAccessToken] = useState(false);

  const title = server ? `Editing "${server.name}"` : 'New Media Source';

  const handleClose = () => {
    reset(emptyDefaults);
    setShowAccessToken(false);
    onClose();
  };

  const {
    control,
    watch,
    reset,
    formState: { isDirty, isValid, defaultValues, errors },
    handleSubmit,
    setError,
    clearErrors,
    getValues,
  } = useForm<JellyfinServerSettingsForm>({
    mode: 'onChange',
    defaultValues: server ?? emptyDefaults,
  });

  // These are updated in a watch callback, so we debounce them
  // along with the details we use to check server status. Otherwise
  // setting the error will cause us to check server status on every
  // keystroke due to re-renders
  const debounceSetError = useDebounceCallback(setError);
  const debounceClearError = useDebounceCallback(clearErrors);

  const updateSourceMutation = useMutation({
    mutationFn: async (newOrUpdatedServer: JellyfinServerSettingsForm) => {
      if (isNonEmptyString(newOrUpdatedServer.id)) {
        await apiClient.updateMediaSource(
          { ...newOrUpdatedServer, id: newOrUpdatedServer.id },
          {
            params: { id: newOrUpdatedServer.id },
          },
        );
        return { id: newOrUpdatedServer.id };
      } else {
        return apiClient.createMediaSource(newOrUpdatedServer);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['settings', 'media-sources'],
      });
      handleClose();
    },
  });

  const showErrorSnack = (e: unknown) => {
    snackbar.enqueueSnackbar({
      variant: 'error',
      message:
        'Error saving new Jellyfin server. See browser console and server logs for details',
    });
    console.error(e);
  };

  const onSubmit = async (e: FormEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const { accessToken, username, password, uri } = getValues();

    if (isNonEmptyString(accessToken)) {
      void handleSubmit(
        (data) => updateSourceMutation.mutate(data),
        showErrorSnack,
      )(e);
    } else if (isNonEmptyString(username) && isNonEmptyString(password)) {
      try {
        const result = await jellyfinLogin(apiClient, {
          username,
          password,
          uri,
        });

        if (isNonEmptyString(result.accessToken)) {
          void handleSubmit(
            (data) =>
              updateSourceMutation.mutate({
                ...data,
                accessToken: result.accessToken!,
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
          // type: 'jellyfin' as const,
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
    useMediaSourceBackendStatus(
      { ...serverStatusDetails, type: 'jellyfin' },
      open,
    );

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
                      : 'Optional. If left blank, the name will be derived from the server'
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
                  <FormControl
                    sx={{ flex: 1 }}
                    variant="outlined"
                    // disabled={isNonEmptyString(accessToken)}
                  >
                    <InputLabel htmlFor="jellyfin-username">
                      Username{' '}
                    </InputLabel>
                    <OutlinedInput
                      id="jellyfin-username"
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
                  <FormControl
                    sx={{ flex: 1 }}
                    variant="outlined"
                    // disabled={isNonEmptyString(accessToken)}
                  >
                    <InputLabel htmlFor="jellyfin-password">
                      Password{' '}
                    </InputLabel>
                    <OutlinedInput
                      id="jellyfin-password"
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
                Enter your Jellyfin password to generate a new access token.
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
                        Manually add an access token from your Jellyfin server
                      </span>
                    </>
                  </FormHelperText>
                </FormControl>
              )}
            />
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
