import { RotatingLoopIcon } from '@/components/base/LoadingIcon';
import { isValidUrl, isNonEmptyString, toggle } from '@/helpers/util';
import { usePlexBackendStatus } from '@/hooks/plex/usePlexBackendStatus';
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
  Link,
  Box,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { PlexServerSettings } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import { useEffect, FormEvent, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { MarkOptional } from 'ts-essentials';
import { useDebounceValue } from 'usehooks-ts';
import { FormType } from '../plex/PlexServerEditDialog';

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

type Props = {
  server?: PlexServerSettings;
  onSuccess?: (data: { id: string }) => void;
};

export function AddPlexServerForm({ server }: Props) {
  // const apiClient = useTunarrApi();
  const [showAccessToken, setShowAccessToken] = useState(false);

  const {
    control,
    watch,
    reset,
    formState: { isDirty, isValid, defaultValues },
    handleSubmit,
  } = useFormContext<FormType>();

  const plexDefaultValues = defaultValues?.plex ?? emptyDefaults;

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
      accessToken: plexDefaultValues.accessToken!,
      uri: plexDefaultValues.uri!,
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
      if (name === 'plex.accessToken' || name === 'plex.uri') {
        updateServerStatusDetails({
          id: server?.id && !isDirty ? server.id : undefined,
          accessToken: value.plex?.accessToken ?? '',
          uri: value.plex?.uri ?? '',
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
    usePlexBackendStatus(serverStatusDetails, true /* TODO is this right */);

  const onSubmit = (e: FormEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    void handleSubmit(
      (data) => updatePlexServerMutation.mutate(data),
      console.error,
    )(e);
  };

  return (
    <>
      <Controller
        control={control}
        name="plex.uri"
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
        name="plex.accessToken"
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
              {error && (
                <>
                  <span>{error.message}</span>
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
        name="plex.name"
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
            helperText={error ? error?.message : null}
          />
        )}
      />
      <Box sx={{ display: 'flex' }}>
        <FormControl sx={{ flexGrow: 0.5 }}>
          <FormControlLabel
            control={
              <Controller
                control={control}
                name="plex.sendGuideUpdates"
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
                name="plex.sendChannelUpdates"
                render={({ field }) => (
                  <Checkbox {...field} checked={field.value} />
                )}
              />
            }
            label="Auto-Update Channels"
          />
        </FormControl>
      </Box>
    </>
  );
}
