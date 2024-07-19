import { RotatingLoopIcon } from '@/components/base/LoadingIcon';
import { isValidUrl, isNonEmptyString, toggle } from '@/helpers/util';
import {
  CloudDoneOutlined,
  CloudOff,
  VisibilityOff,
  Visibility,
} from '@mui/icons-material';
import {
  TextField,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  IconButton,
  FormHelperText,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import { JellyfinServerSettings } from '@tunarr/types';
import { isEqual, isUndefined } from 'lodash-es';
import { useEffect, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useDebounceValue } from 'usehooks-ts';
import {
  FormType,
  JellyfinServerSettingsForm,
} from '../plex/PlexServerEditDialog';
import { useJellyfinBackendStatus } from '@/hooks/jellyfin/useJellyfinBackendStatus';

type Props = {
  server?: JellyfinServerSettings;
  onSuccess?: (data: { id: string }) => void;
};

const emptyDefaults: JellyfinServerSettingsForm = {
  type: 'jellyfin',
  uri: '',
  name: '',
  accessToken: '',
  username: '',
  password: '',
};

export function EditJellyfinServerForm({ server }: Props) {
  // const apiClient = useTunarrApi();
  const [showAccessToken, setShowAccessToken] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    watch,
    formState: { isDirty, defaultValues },
  } = useFormContext<FormType>();
  const jellyfinDefaultValues = defaultValues?.jellyfin ?? emptyDefaults;

  // const updatePlexServerMutation = useMutation({
  //   mutationFn: async (newOrUpdatedServer: PlexServerSettingsForm) => {
  //     if (isNonEmptyString(newOrUpdatedServer.id)) {
  //       await apiClient.updatePlexServer(newOrUpdatedServer, {
  //         params: { id: newOrUpdatedServer.id },
  //       });
  //       return { id: newOrUpdatedServer.id };
  //     } else {
  //       return apiClient.createPlexServer(newOrUpdatedServer);
  //     }
  //   },
  //   onSuccess: async (data) => {
  //     await queryClient.invalidateQueries({
  //       queryKey: ['settings', 'plex-servers'],
  //     });
  //     if (onSuccess) {
  //       onSuccess(data);
  //     }
  //   },
  // });

  const [serverStatusDetails, updateServerStatusDetails] = useDebounceValue(
    {
      id: server?.id && !isDirty ? server.id : undefined,
      accessToken: jellyfinDefaultValues.accessToken!,
      uri: jellyfinDefaultValues.uri!,
      username: jellyfinDefaultValues.username,
      password: jellyfinDefaultValues.password,
    },
    500,
    {
      equalityFn: isEqual,
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
        name === 'jellyfin.uri' ||
        name === 'jellyfin.password' ||
        name === 'jellyfin.username' ||
        name === 'jellyfin.accessToken'
      ) {
        updateServerStatusDetails({
          id: server?.id && !isDirty ? server.id : undefined,
          accessToken:
            value.jellyfin?.accessToken ?? value.jellyfin?.password ?? '',
          uri: value.jellyfin?.uri ?? '',
          username: value.jellyfin?.username ?? '',
          password: value.jellyfin?.password ?? '',
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
    useJellyfinBackendStatus(
      serverStatusDetails,
      true /* TODO is this right */,
    );

  return (
    <>
      <Controller
        control={control}
        name="jellyfin.uri"
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
        name="jellyfin.name"
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
          name="jellyfin.username"
          rules={{
            required: true,
            minLength: 1,
          }}
          render={({ field, fieldState: { error } }) => (
            <FormControl sx={{ flex: 1 }} variant="outlined">
              <InputLabel htmlFor="jellyfin-username">Username </InputLabel>
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
          name="jellyfin.password"
          rules={{
            required: true,
            minLength: 1,
          }}
          render={({ field, fieldState: { error } }) => (
            <FormControl sx={{ flex: 1 }} variant="outlined">
              <InputLabel htmlFor="jellyfin-password">Password </InputLabel>
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
        <Typography variant="caption" sx={{ px: 2 }}>
          Enter your Jellyfin password to generate a new access token, or enter
          the token you want to use below.
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Divider sx={{ flex: 1 }} />
        <Typography variant="caption">OR</Typography>
        <Divider sx={{ flex: 1 }} />
      </Box>
      <Controller
        control={control}
        name="jellyfin.accessToken"
        rules={{
          required: true,
          minLength: 1,
        }}
        render={({ field, fieldState: { error } }) => (
          <FormControl sx={{ m: 1 }} fullWidth variant="outlined">
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

      {/* <Box sx={{ display: 'flex' }}>
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
      </Box> */}
    </>
  );
}
