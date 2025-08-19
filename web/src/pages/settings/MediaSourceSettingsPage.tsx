import UnsavedNavigationAlert from '@/components/settings/UnsavedNavigationAlert.tsx';
import { AddMediaSourceButton } from '@/components/settings/media_source/AddMediaSourceButton.tsx';
import { MediaSourceTableRow } from '@/components/settings/media_source/MediaSourceTableRow';
import {
  CheckboxFormController,
  TypedController,
} from '@/components/util/TypedController.tsx';
import {
  useMediaSources,
  usePlexStreamSettings,
} from '@/hooks/settingsHooks.ts';
import { HelpOutline } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { PlexStreamSettings } from '@tunarr/types';
import { defaultPlexStreamSettings } from '@tunarr/types';
import { fill, isEqual, map } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import { putApiPlexSettingsMutation } from '../../generated/@tanstack/react-query.gen.ts';

const supportedPaths = [
  { value: 'network', string: 'Network' },
  { value: 'direct', string: 'Direct' },
];

export default function MediaSourceSettingsPage() {
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);

  const serverQuery = useMediaSources();
  const {
    data: servers,
    isPending: serversPending,
    error: serversError,
  } = serverQuery;

  const { data: streamSettings, error: streamsError } = usePlexStreamSettings();

  const snackbar = useSnackbar();

  const {
    reset,
    control,
    formState: { isDirty, isValid, isSubmitting, defaultValues },
    watch,
    handleSubmit,
  } = useForm<PlexStreamSettings>({
    defaultValues: defaultPlexStreamSettings,
    mode: 'onBlur',
  });

  const streamPath = watch('streamPath');

  useEffect(() => {
    if (streamSettings) {
      reset({
        ...streamSettings,
      });
    }
  }, [streamSettings, reset]);

  const queryClient = useQueryClient();

  const updatePlexStreamingSettingsMutation = useMutation({
    ...putApiPlexSettingsMutation(),
    onSuccess: (data) => {
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      setRestoreTunarrDefaults(false);
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        queryKey: ['Settings'],
      });
    },
  });

  const updatePlexStreamSettings: SubmitHandler<PlexStreamSettings> = (
    streamSettings,
  ) => {
    updatePlexStreamingSettingsMutation.mutate({
      body: {
        ...streamSettings,
      },
    });
  };

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (serversError || streamsError) {
    return <h1>XML: {(serversError ?? streamsError)!.message}</h1>;
  }

  const getTableRows = () => {
    return map(servers, (server) => {
      return <MediaSourceTableRow key={server.id} server={server} />;
    });
  };

  const getSkeletonTableRows = (numRows: number) => {
    return [...fill(Array(numRows), null)].map((_, index) => (
      <TableRow key={index}>
        <TableCell component="th" scope="row">
          <Skeleton animation="wave" variant="text" />
        </TableCell>
        <TableCell>
          <Skeleton animation="wave" variant="text" />
        </TableCell>
        <TableCell>
          <Skeleton animation="wave" variant="text" />
        </TableCell>
        <TableCell>
          <Skeleton animation="wave" variant="text" />
        </TableCell>
      </TableRow>
    ));
  };

  const renderServersTable = () => {
    return (
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Type</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell align="center" sx={{ minWidth: 125 }}>
                Healthy?
                <Tooltip
                  placement="top"
                  componentsProps={{
                    popper: {
                      sx: { textAlign: 'center' },
                    },
                  }}
                  title={
                    <span>
                      The connection to the media source
                      <br />
                      from the Tunarr server.
                    </span>
                  }
                >
                  <IconButton size="small" edge="end">
                    <HelpOutline sx={{ opacity: 0.75 }} />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell sx={{ minWidth: 125 }}></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {serversPending ? getSkeletonTableRows(2) : getTableRows()}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  const renderPathReplacements = () => {
    return (
      <>
        <Typography component="h6" sx={{ my: 2 }}>
          Path Replacements
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <Controller
                control={control}
                name="pathReplace"
                render={({ field }) => (
                  <TextField
                    id="original-path-replace"
                    label="Original Plex path to replace"
                    {...field}
                  />
                )}
              />
            </FormControl>

            <FormControl fullWidth sx={{ my: 1 }}>
              <Controller
                control={control}
                name="pathReplaceWith"
                render={({ field }) => (
                  <TextField
                    id="new-path-replace-with"
                    label="Replace Plex path with"
                    {...field}
                  />
                )}
              />
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

  return (
    <Box component="form" onSubmit={handleSubmit(updatePlexStreamSettings)}>
      <Box>
        <Box mb={2}>
          <Stack
            spacing={1}
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            <Typography
              variant="h6"
              sx={(theme) => ({
                flexGrow: 1,
                [theme.breakpoints.down('sm')]: {
                  width: '100%',
                },
              })}
            >
              Media Sources
            </Typography>
            <AddMediaSourceButton />
            <Box sx={{ flexBasis: '100%', width: 0 }}></Box>
            <Typography variant="caption" sx={{ width: '60%' }}>
              Add sources of content for your channels.
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}></Box>
          {renderServersTable()}
        </Box>
        <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
          Streaming Options
        </Typography>

        <Grid flex="1 0 50%" container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <InputLabel id="stream-path-label">Stream Path</InputLabel>
              <TypedController
                control={control}
                name="streamPath"
                render={({ field }) => (
                  <Select
                    labelId="stream-path-label"
                    id="stream-path"
                    label="Stream Path"
                    {...field}
                  >
                    {supportedPaths.map((path) => (
                      <MenuItem key={path.value} value={path.value}>
                        {path.string}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />
              <FormHelperText>
                <strong>Network</strong>: This option will initialize the stream
                over the network, e.g. stream from the Plex server
                <br />
                <strong>Direct</strong>: This option attempts to open the file
                from the filesystem, using the file path provided by Plex. This
                path can be normalized for Tunarr using a find/replace string
                combination
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <CheckboxFormController
                    control={control}
                    name="updatePlayStatus"
                  />
                }
                label="Send play status to Media Source"
              />
              <FormHelperText>
                Note: This affects the "continue watching" section of the media
                source.
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
        <Box sx={{ display: 'block', p: 2 }}>
          {streamPath === 'direct' ? renderPathReplacements() : null}
        </Box>
        <UnsavedNavigationAlert isDirty={isDirty} />
        <Stack spacing={2} direction="row" sx={{ mt: 2 }}>
          <Stack
            spacing={2}
            direction="row"
            justifyContent="left"
            sx={{ mt: 2, flexGrow: 1 }}
          >
            {!isEqual(defaultValues, defaultPlexStreamSettings) && (
              <Button
                variant="outlined"
                onClick={() => {
                  reset(defaultPlexStreamSettings);
                  setRestoreTunarrDefaults(true);
                }}
              >
                Restore Default Settings
              </Button>
            )}
          </Stack>
          <Stack
            spacing={2}
            direction="row"
            justifyContent="right"
            sx={{ mt: 2 }}
          >
            {isDirty && (
              <Button
                variant="outlined"
                onClick={() => {
                  reset(streamSettings);
                  setRestoreTunarrDefaults(false);
                }}
              >
                Reset Changes
              </Button>
            )}
            <Button
              variant="contained"
              disabled={
                !isValid || isSubmitting || (!isDirty && !restoreTunarrDefaults)
              }
              type="submit"
            >
              Save
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
