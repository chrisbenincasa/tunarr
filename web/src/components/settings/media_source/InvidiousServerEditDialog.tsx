import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { Add, CloudDoneOutlined, CloudOff, Delete } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { isNonEmptyString } from '@tunarr/shared/util';
import type { InvidiousServerSettings } from '@tunarr/types';
import { useDebounce } from '@uidotdev/usehooks';
import { isEmpty, isUndefined } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import type { MarkOptional, StrictOmit } from 'ts-essentials';
import { postApiMediaSourcesInvidiousResolveChannels } from '../../../generated/sdk.gen.ts';
import {
  useCreateMediaSource,
  useUpdateMediaSource,
} from '../../../hooks/media-sources/mediaSourceHooks.ts';
import type { CommonDialogProps } from '../../../types/CommonDialogProps.ts';
import { RotatingLoopIcon } from '../../base/LoadingIcon.tsx';

type Props = CommonDialogProps & {
  server?: InvidiousServerSettings;
};

type InvidiousServerForm = MarkOptional<
  StrictOmit<InvidiousServerSettings, 'libraries'>,
  'id'
>;

const emptyDefaults = () =>
  ({
    type: 'invidious',
    name: '',
    uri: '',
    channelIds: [],
    pathReplacements: [],
    userId: null,
    username: null,
    sendPlayStatusUpdates: false,
  }) satisfies InvidiousServerForm;

const InvidiousServerEditDialogContent = ({ onClose, server }: Props) => {
  const {
    control,
    watch,
    setValue,
    formState: { isDirty, isValid, errors },
    handleSubmit,
    register,
    getValues,
    trigger,
  } = useForm<InvidiousServerForm>({
    mode: 'onChange',
    defaultValues: server
      ? {
          ...server,
          channelIds: server.libraries.map((library) => library.externalKey),
        }
      : emptyDefaults(),
    reValidateMode: 'onChange',
  });

  const snackbar = useSnackbar();
  const channelIds = watch('channelIds');
  const uri = watch('uri');
  const debouncedUri = useDebounce(uri, 500);

  register('channelIds', {
    validate: (ids) => {
      if (ids.length === 0) {
        return t`Add at least one YouTube channel`;
      }
    },
  });

  // Display names for channel ids, seeded from existing libraries and filled
  // in as new channels are resolved.
  const [channelNames, setChannelNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      (server?.libraries ?? []).map((library) => [
        library.externalKey,
        library.name,
      ]),
    ),
  );
  const [serverHealthy, setServerHealthy] = useState<boolean | null>(null);
  const [currentChannel, setCurrentChannel] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const createMediaSourceMut = useCreateMediaSource();
  const updateMediaSourceMut = useUpdateMediaSource();

  useEffect(() => {
    if (!isNonEmptyString(debouncedUri)) {
      setServerHealthy(null);
      return;
    }
    postApiMediaSourcesInvidiousResolveChannels({
      body: { uri: debouncedUri, channels: [] },
      throwOnError: true,
    })
      .then((result) => setServerHealthy(result.data.healthy))
      .catch(() => setServerHealthy(false));
  }, [debouncedUri]);

  const addChannel = useCallback(async () => {
    setResolving(true);
    setResolveError(null);
    try {
      const result = await postApiMediaSourcesInvidiousResolveChannels({
        body: { uri: getValues('uri'), channels: [currentChannel] },
        throwOnError: true,
      });
      const resolved = result.data.channels[0];
      if (!result.data.healthy || !resolved?.channelId) {
        setResolveError(t`Could not find that YouTube channel`);
        return;
      }
      const channelId = resolved.channelId;
      if (!getValues('channelIds').includes(channelId)) {
        setValue('channelIds', [...getValues('channelIds'), channelId], {
          shouldDirty: true,
        });
      }
      setChannelNames((names) => ({
        ...names,
        [channelId]: resolved.name ?? channelId,
      }));
      setCurrentChannel('');
      await trigger('channelIds');
    } catch (e) {
      console.error(e);
      setResolveError(t`Could not reach the Invidious server`);
    } finally {
      setResolving(false);
    }
  }, [currentChannel, getValues, setValue, trigger]);

  const removeChannel = useCallback(
    (channelId: string) => {
      setValue(
        'channelIds',
        getValues('channelIds').filter((id) => id !== channelId),
        { shouldDirty: true },
      );
      trigger('channelIds').catch(console.error);
    },
    [getValues, setValue, trigger],
  );

  const onSubmitSuccess = useCallback(
    (values: InvidiousServerForm) => {
      const body = {
        type: 'invidious' as const,
        name: values.name,
        uri: values.uri,
        channelIds: values.channelIds,
        pathReplacements: [],
        userId: null,
        username: null,
        sendPlayStatusUpdates: false,
      };
      if (values.id) {
        updateMediaSourceMut.mutate(
          { path: { id: values.id }, body: { ...body, id: values.id } },
          { onSuccess: () => onClose() },
        );
      } else {
        createMediaSourceMut.mutate({ body }, { onSuccess: () => onClose() });
      }
    },
    [createMediaSourceMut, onClose, updateMediaSourceMut],
  );

  const onSubmitError = useCallback(
    (err: FieldErrors<InvidiousServerForm>) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        message: t`There was an error when submitting the form. Please see console logs for details.`,
        variant: 'error',
      });
    },
    [snackbar],
  );

  const title = server
    ? t`Editing "${server.name}"`
    : t`New Invidious (YouTube) Source`;

  return (
    <>
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
              rules={{ required: true, minLength: 1 }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label={t`Name`}
                  fullWidth
                  {...field}
                  error={!isUndefined(error)}
                  helperText={t`A name for this source, e.g. "YouTube"`}
                />
              )}
            />
            <Controller
              control={control}
              name="uri"
              rules={{ required: true, minLength: 1 }}
              render={({ field, fieldState: { error } }) => (
                <TextField
                  label={t`Invidious URL`}
                  fullWidth
                  {...field}
                  error={!isUndefined(error) || serverHealthy === false}
                  helperText={t`The base URL of your Invidious instance, as reachable from the Tunarr server`}
                  slotProps={{
                    input: {
                      spellCheck: false,
                      endAdornment:
                        serverHealthy === null ? null : serverHealthy ? (
                          <CloudDoneOutlined color="success" />
                        ) : (
                          <CloudOff color="error" />
                        ),
                    },
                  }}
                />
              )}
            />
            <Stack direction={'row'} spacing={1} alignItems="center">
              <TextField
                label={t`YouTube channel`}
                fullWidth
                value={currentChannel}
                onChange={(e) => {
                  setCurrentChannel(e.target.value);
                  setResolveError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (isNonEmptyString(currentChannel) && serverHealthy) {
                      addChannel().catch(console.error);
                    }
                  }
                }}
                error={resolveError !== null}
                helperText={
                  resolveError ??
                  t`A channel @handle, channel URL or UC… channel ID. Each channel becomes a library.`
                }
                slotProps={{
                  input: {
                    spellCheck: false,
                    endAdornment: resolving ? <RotatingLoopIcon /> : null,
                  },
                }}
              />
              <IconButton
                disabled={
                  !isNonEmptyString(currentChannel) ||
                  !serverHealthy ||
                  resolving
                }
                onClick={() => addChannel().catch(console.error)}
              >
                <Add />
              </IconButton>
            </Stack>
            <Divider />
            <Box>
              <Typography variant="h6">
                <Trans>Channels</Trans> ({channelIds.length})
              </Typography>
              <List sx={{ pl: 1, py: 0 }}>
                {channelIds.map((channelId) => (
                  <ListItem
                    disableGutters
                    key={channelId}
                    secondaryAction={
                      <IconButton
                        sx={{ p: 1 }}
                        onClick={() => removeChannel(channelId)}
                      >
                        <Delete />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={channelNames[channelId] ?? channelId}
                      secondary={channelId}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => onClose()} autoFocus>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="contained"
          disabled={!isDirty || !isValid || !isEmpty(errors)}
          type="submit"
          onClick={handleSubmit(onSubmitSuccess, onSubmitError)}
        >
          {server?.id ? <Trans>Update</Trans> : <Trans>Add</Trans>}
        </Button>
      </DialogActions>
    </>
  );
};

export const InvidiousServerEditDialog = (props: Props) => {
  const { onClose, open } = props;
  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <InvidiousServerEditDialogContent {...props} />
    </Dialog>
  );
};
