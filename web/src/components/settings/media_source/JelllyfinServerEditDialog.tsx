import { isNonEmptyString, isValidUrl, toggle } from '@/helpers/util';
import { useTunarrApi } from '@/hooks/useTunarrApi';

import { RotatingLoopIcon } from '@/components/base/LoadingIcon.tsx';
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
import { isEmpty, isEqual, isNull, isUndefined } from 'lodash-es';
import { FormEvent, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MarkOptional } from 'ts-essentials';
import { useDebounceValue } from 'usehooks-ts';
import { useJellyinLogin } from '@/hooks/jellyfin/useJellyfinLogin.ts';
import { useMediaSourceBackendStatus } from '@/hooks/media-sources/useMediaSourceBackendStatus';

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
    formState: { isDirty, isValid, defaultValues, touchedFields, errors },
    handleSubmit,
    setValue,
    getValues,
    setError,
    clearErrors,
  } = useForm<JellyfinServerSettingsForm>({
    // mode: 'onChange',
    defaultValues: server ?? emptyDefaults,
  });

  const [username, password, accessToken] = watch([
    'username',
    'password',
    'accessToken',
  ]);

  useEffect(() => {
    const sub = watch((value, { name }) => {
      if (
        name !== 'accessToken' &&
        name !== 'username' &&
        name !== 'password'
      ) {
        return;
      }

      if (
        isNonEmptyString(value.accessToken) ||
        (isNonEmptyString(value.username) && isNonEmptyString(value.password))
      ) {
        clearErrors('root.auth');
      } else {
        setError('root.auth', { message: 'No' });
      }
    });
    return () => sub.unsubscribe();
  }, [watch, setError, clearErrors]);

  const accessTokenTouched = touchedFields.accessToken ?? false;

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

  const onSubmit = (e: FormEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    if (isNonEmptyString(accessToken)) {
    } else if (isNonEmptyString(username) && isNonEmptyString(password)) {
    }

    void handleSubmit(
      (data) => updateSourceMutation.mutate(data),
      console.error,
    )(e);
  };

  const [showPassword, setShowPassword] = useState(false);

  const [serverStatusDetails, updateServerStatusDetails] = useDebounceValue(
    {
      id: server?.id && !isDirty ? server.id : undefined,
      accessToken: defaultValues?.accessToken ?? '',
      uri: defaultValues?.uri ?? '',
      username: defaultValues?.username ?? '',
      password: defaultValues?.password ?? '',
      type: 'jellyfin' as const,
    },
    5000,
    {
      equalityFn: (left, right) => {
        const res = isEqual(left, right);
        console.log(left, right, res);
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
        name === 'uri' ||
        // name === 'password' ||
        // name === 'username' ||
        name === 'accessToken'
      ) {
        updateServerStatusDetails({
          id: server?.id && !isDirty ? server.id : undefined,
          accessToken: value.accessToken ?? value.password ?? '',
          uri: value.uri ?? '',
          username: value.username ?? '',
          password: value.password ?? '',
          type: 'jellyfin' as const,
        });
      }
    });

    return () => sub.unsubscribe();
  }, [
    watch,
    updateServerStatusDetails,
    serverStatusDetails,
    server?.id,
    isDirty,
  ]);

  const {
    data: derivedAccessToken,
    isLoading: derivedAccessTokenLoading,
    error: derivedAccessTokenError,
    refetch: refetchAccessToken,
  } = useJellyinLogin(serverStatusDetails, false /* TODO is this right */);

  // useEffect(() => {
  //   if (
  //     isNonEmptyString(serverStatusDetails.url) &&
  //     isNonEmptyString(serverStatusDetails.username) &&
  //     isNonEmptyString(serverStatusDetails.password)
  //   ) {
  //     jellyfinLogin(apiClient, serverStatusDetails)
  //       .then(({ accessToken }) => {
  //         if (isNonEmptyString(accessToken) && !accessTokenTouched) {
  //           setValue('accessToken', derivedAccessToken?.accessToken ?? '', {
  //             shouldValidate: true,
  //           });
  //         }
  //       })
  //       .catch(console.error);
  //   }
  // }, [
  //   serverStatusDetails,
  //   apiClient,
  //   accessTokenTouched,
  //   setValue,
  //   derivedAccessToken?.accessToken,
  // ]);

  const { data: serverStatus, isLoading: serverStatusLoading } =
    useMediaSourceBackendStatus(
      serverStatusDetails,
      open && isNonEmptyString(accessToken),
    );
  console.log(serverStatusDetails);

  useEffect(() => {
    if (!isUndefined(derivedAccessToken) && !accessTokenTouched) {
      setValue('accessToken', derivedAccessToken?.accessToken ?? '', {
        shouldValidate: true,
      });
    }
    //  else if (!isUndefined(serverError) && !accessTokenTouched) {
    //   setValue('accessToken', '');
    // }
  }, [
    derivedAccessToken,
    derivedAccessTokenError,
    setValue,
    getValues,
    accessTokenTouched,
  ]);

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
                    return isValidUrl(value) ? undefined : 'Not a valid URL';
                  },
                },
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label="URL"
                  fullWidth
                  {...field}
                  error={
                    !isUndefined(error) || !isNull(derivedAccessTokenError)
                  }
                  helperText={
                    error?.message ? (
                      <span>{error.message}</span>
                    ) : !isNull(derivedAccessTokenError) &&
                      isNonEmptyString(field.value) ? (
                      <>
                        <span>Server is unreachable</span>
                        <br />
                      </>
                    ) : null
                  }
                  InputProps={{
                    endAdornment: derivedAccessTokenLoading ? (
                      <RotatingLoopIcon />
                    ) : !isUndefined(derivedAccessToken) &&
                      isNull(derivedAccessTokenError) ? (
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
                    disabled={isNonEmptyString(accessToken)}
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
                    disabled={isNonEmptyString(accessToken)}
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
                      {/* <span>
                  Enter your Jellyfin password to generate a new access token,
                  or enter the token you want to use below.
                </span> */}
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
                  disabled={
                    isNonEmptyString(username) && isNonEmptyString(password)
                  }
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
          disabled={!isDirty || !isValid || !isEmpty(errors)}
          type="submit"
          onClick={onSubmit}
        >
          {server?.id ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
