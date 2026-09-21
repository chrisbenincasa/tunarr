import { RotatingLoopIcon } from '@/components/base/LoadingIcon';
import { isNonEmptyString, isValidUrlWithError, toggle } from '@/helpers/util';
import { useMediaSourceBackendStatus } from '@/hooks/media-sources/useMediaSourceBackendStatus';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import {
  CloudDoneOutlined,
  CloudOff,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  OutlinedInput,
  Stack,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlexServerSettings } from '@tunarr/types';
import { isUndefined } from 'lodash-es';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import type { MarkOptional, StrictOmit } from 'ts-essentials';
import { useDebounceValue } from 'usehooks-ts';
import { getApiMediaSourcesQueryKey } from '../../../generated/@tanstack/react-query.gen.ts';
import {
  postApiMediaSources,
  putApiMediaSourcesById,
} from '../../../generated/sdk.gen.ts';
import { NetworkIcon } from '../../util/NetworkIcon.tsx';
import { EditPathReplacementsForm } from './EditPathReplacementsForm.tsx';

type Props = {
  open: boolean;
  onClose: () => void;
  server?: PlexServerSettings;
};

type PlexServerSettingsForm = MarkOptional<
  StrictOmit<PlexServerSettings, 'clientIdentifier' | 'libraries'>,
  'id'
>;

const emptyDefaults: PlexServerSettingsForm = {
  uri: '',
  name: '',
  accessToken: '',
  sendGuideUpdates: false,
  sendPlayStatusUpdates: false,
  index: 0,
  type: 'plex',
  userId: '',
  username: '',
  pathReplacements: [],
};

export function PlexServerEditDialog({ open, onClose, server }: Props) {
  const queryClient = useQueryClient();

  const [showAccessToken, setShowAccessToken] = useState(false);

  const title = server
    ? t`Editing Plex Server "${server.name}"`
    : t`New Plex Server`;

  const handleClose = () => {
    setShowAccessToken(false);
    onClose();
  };

  const form = useForm<PlexServerSettingsForm>({
    mode: 'onChange',
    defaultValues: server ?? emptyDefaults,
  });
  const {
    control,
    watch,
    reset,
    formState: { isDirty, isValid, defaultValues, dirtyFields },
    handleSubmit,
  } = form;

  useEffect(() => {
    if (open) {
      reset(server ?? emptyDefaults);
    }
  }, [open, reset, server]);

  const updatePlexServerMutation = useMutation({
    mutationFn: async (newOrUpdatedServer: PlexServerSettingsForm) => {
      const accessToken = newOrUpdatedServer.accessToken;
      if (!isNonEmptyString(accessToken)) {
        return;
      }
      if (isNonEmptyString(newOrUpdatedServer.id)) {
        await putApiMediaSourcesById({
          body: {
            ...newOrUpdatedServer,
            id: newOrUpdatedServer.id,
            accessToken,
          },
          path: { id: newOrUpdatedServer.id },
        });
        return { id: newOrUpdatedServer.id };
      } else {
        return postApiMediaSources({
          body: { ...newOrUpdatedServer, accessToken },
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: getApiMediaSourcesQueryKey(),
        exact: true,
      });
      handleClose();
    },
  });

  const [serverStatusDetails, updateServerStatusDetails] = useDebounceValue(
    {
      id: server?.id && !dirtyFields.accessToken ? server.id : undefined,
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
  }, [watch, updateServerStatusDetails, server?.id, isDirty]);

  const { data: serverStatus, isLoading: serverStatusLoading } =
    useMediaSourceBackendStatus({ ...serverStatusDetails, type: 'plex' }, open);

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
      onClose={() => onClose()}
    >
      <DialogTitle sx={{ pb: 0 }}>
        <Box sx={{ display: 'inline-flex', gap: 0.5 }}>
          <NetworkIcon width={20} network="plex" /> <span>{title}</span>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Box>
          <Stack sx={{ py: 2 }} spacing={2}>
            <Controller
              control={control}
              name="uri"
              rules={{
                validate: {
                  url: (value) => {
                    const err = isValidUrlWithError(value);
                    if (isUndefined(err)) {
                      return undefined;
                    }

                    switch (err) {
                      case 'empty':
                        return t`Cannot be empty`;
                      case 'not_parseable':
                        return t`Not a valid URL`;
                      case 'wrong_protocol':
                        return t`Protocol must be HTTP or HTTPS`;
                    }
                  },
                },
              }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label={t`URL`}
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
                        <span>
                          <Trans>Server is unreachable</Trans>
                        </span>
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
                  <InputLabel htmlFor="access-token">
                    <Trans>Access Token</Trans>{' '}
                  </InputLabel>
                  <OutlinedInput
                    id="access-token"
                    type={showAccessToken ? 'text' : 'password'}
                    error={!isUndefined(errors.accessToken)}
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={t`toggle access token visibility`}
                          onClick={() => setShowAccessToken(toggle)}
                          edge="end"
                        >
                          {showAccessToken ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label={t`Access Token`}
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
                      <Trans>
                        For more details on manually retrieving a Plex token,
                        see{' '}
                        <Link
                          href="https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/"
                          target="_blank"
                        >
                          here
                        </Link>
                      </Trans>
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
                  message: t`Name can only contain alphanumeric characters, dashes, and underscores`,
                },
              }}
              render={({ field, formState: { errors } }) => (
                <TextField
                  label={t`Name`}
                  fullWidth
                  {...field}
                  error={!isUndefined(errors.name)}
                  helperText={errors.name ? errors.name?.message : null}
                />
              )}
            />
            <Divider />
            <Box>
              <FormProvider {...form}>
                <EditPathReplacementsForm />
              </FormProvider>
            </Box>
            <Divider />
            <Stack direction={'row'}>
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
                  label={t`Auto-Update Guide`}
                />
                <FormHelperText>
                  <Trans>
                    Tunarr will attempt to get Plex to pull Tunarr's updated
                    XMLTV upon regeneration
                  </Trans>
                </FormHelperText>
              </FormControl>
              <FormControl sx={{ flexGrow: 0.5 }}>
                <FormControlLabel
                  control={
                    <Controller
                      control={control}
                      name="sendPlayStatusUpdates"
                      render={({ field }) => (
                        <Checkbox {...field} checked={field.value} />
                      )}
                    />
                  }
                  label={t`Update Play Status`}
                />
                <FormHelperText>
                  <Trans>
                    Tunarr will update Plex's "now playing" state while channels
                    are active.
                  </Trans>
                </FormHelperText>
              </FormControl>
            </Stack>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => handleClose()} autoFocus>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="contained"
          disabled={!isDirty || !isValid}
          type="submit"
        >
          {server?.id ? <Trans>Update</Trans> : <Trans>Add</Trans>}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
