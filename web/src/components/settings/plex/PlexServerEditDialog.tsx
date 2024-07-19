import { RotatingLoopIcon } from '@/components/base/LoadingIcon';
import { isNonEmptyString, isValidUrl, toggle } from '@/helpers/util';
import { usePlexBackendStatus } from '@/hooks/plex/usePlexBackendStatus';
import { useTunarrApi } from '@/hooks/useTunarrApi';
import {
  VisibilityOff,
  Visibility,
  CloudDoneOutlined,
  CloudOff,
} from '@mui/icons-material';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Stack,
  TextField,
  FormHelperText,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Checkbox,
  FormControlLabel,
  Link,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlexServerSettings } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { FormEvent, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { MarkOptional } from 'ts-essentials';
import { useDebounceValue } from 'usehooks-ts';

type Props = {
  open: boolean;
  onClose: () => void;
  server?: PlexServerSettings;
};

type PlexServerSettingsForm = MarkOptional<
  Omit<PlexServerSettings, 'clientIdentifier'>,
  'id'
>;

const emptyDefaults: PlexServerSettingsForm = {
  uri: '',
  name: '',
  accessToken: '',
  sendChannelUpdates: false,
  sendGuideUpdates: false,
  index: 0,
};

export function PlexServerEditDialog({ open, onClose, server }: Props) {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();

  const [showAccessToken, setShowAccessToken] = useState(false);

  const title = server ? `Editing "${server.name}"` : 'New Plex Server';

  const handleClose = () => {
    reset(emptyDefaults);
    setShowAccessToken(false);
    onClose();
  };

  const {
    control,
    watch,
    reset,
    formState: { isDirty, isValid, defaultValues },
    handleSubmit,
  } = useForm<PlexServerSettingsForm>({
    mode: 'onChange',
    defaultValues: server ?? emptyDefaults,
  });

  const updatePlexServerMutation = useMutation({
    mutationFn: async (newOrUpdatedServer: PlexServerSettingsForm) => {
      if (isNonEmptyString(newOrUpdatedServer.id)) {
        await apiClient.updatePlexServer(newOrUpdatedServer, {
          params: { id: newOrUpdatedServer.id },
        });
        return { id: newOrUpdatedServer.id };
      } else {
        return apiClient.createPlexServer(newOrUpdatedServer);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
      handleClose();
    },
  });

  const [serverStatusDetails, updateServerStatusDetails] = useDebounceValue(
    {
      id: server?.id && !isDirty ? server.id : undefined,
      accessToken: defaultValues!.accessToken!,
      uri: defaultValues!.uri!,
    },
    500,
    {
      equalityFn(left, right) {
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
      if (name === 'accessToken' || name === 'uri') {
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
    serverStatusDetails,
    server?.id,
    isDirty,
  ]);

  const { data: serverStatus, isLoading: serverStatusLoading } =
    usePlexBackendStatus(serverStatusDetails, open);

  const onSubmit = (e: FormEvent<HTMLDivElement>) => {
    e.stopPropagation();
    void handleSubmit(
      (data) => updatePlexServerMutation.mutate(data),
      console.error,
    )(e);
  };

  // TODO: Block creation if an existing server with the same URL/name
  // already exist
  return (
    <Dialog
      open={open}
      fullWidth
      component="form"
      onSubmit={onSubmit}
      keepMounted={false}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box>
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
                    ) : serverStatus?.healthy ? (
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
              name="accessToken"
              rules={{
                required: true,
                minLength: 1,
              }}
              render={({ field, formState: { errors } }) => (
                <FormControl sx={{ m: 1 }} fullWidth variant="outlined">
                  <InputLabel htmlFor="access-token">Access Token </InputLabel>
                  <OutlinedInput
                    id="access-token"
                    type={showAccessToken ? 'text' : 'password'}
                    error={!isUndefined(errors.accessToken)}
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
                    {errors.accessToken && (
                      <>
                        <span>{errors.accessToken.message}</span>
                        <br />
                      </>
                    )}
                    <span>
                      For more details on manually retrieving a Plex token, see{' '}
                      <Link
                        href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                        target="_blank"
                      >
                        here
                      </Link>
                    </span>
                  </FormHelperText>
                </FormControl>
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
              render={({ field, formState: { errors } }) => (
                <TextField
                  label="Name"
                  fullWidth
                  {...field}
                  error={!isUndefined(errors.name)}
                  helperText={errors.name ? errors.name?.message : null}
                />
              )}
            />
            <Box sx={{ display: 'flex' }}>
              <FormControl sx={{ flexGrow: 0.5 }}>
                <FormControlLabel
                  control={
                    <Controller
                      control={control}
                      name="sendGuideUpdates"
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value} />
                      )}
                    />
                  }
                  label="Auto-Update Guide"
                />
              </FormControl>
              <FormControl>
                <FormControlLabel
                  control={
                    <Controller
                      control={control}
                      name="sendChannelUpdates"
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value} />
                      )}
                    />
                  }
                  label="Auto-Update Channels"
                />
              </FormControl>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => handleClose()} autoFocus>
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!isDirty || !isValid}
          type="submit"
        >
          {server?.id ? 'Update' : 'Add'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
