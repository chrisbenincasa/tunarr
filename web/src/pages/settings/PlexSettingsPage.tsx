import { Add, AutoFixHigh, HelpOutline } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import { PlexStreamSettings, defaultPlexStreamSettings } from '@tunarr/types';
import _, { fill, map } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import AddPlexServer from '@/components/settings/AddPlexServer.tsx';
import UnsavedNavigationAlert from '@/components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  TypedController,
} from '@/components/util/TypedController.tsx';
import {
  usePlexServerSettings,
  usePlexStreamSettings,
} from '@/hooks/settingsHooks.ts';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { PlexServerRow } from '@/components/settings/plex/PlexServerRow.tsx';
import { PlexServerEditDialog } from '@/components/settings/plex/PlexServerEditDialog.tsx';

const supportedPaths = [
  { value: 'plex', string: 'Plex' },
  { value: 'direct', string: 'Direct' },
];

export default function PlexSettingsPage() {
  const apiClient = useTunarrApi();
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);
  const [plexEditDialogOpen, setPlexEditDialogOpen] = useState(false);

  const {
    data: servers,
    isPending: serversPending,
    error: serversError,
  } = usePlexServerSettings();

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
      reset(streamSettings);
    }
  }, [streamSettings, reset]);

  const queryClient = useQueryClient();

  const updatePlexStreamingSettingsMutation = useMutation({
    mutationFn: apiClient.updatePlexStreamSettings,
    onSuccess: (data) => {
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      setRestoreTunarrDefaults(false);
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-settings'],
      });
    },
  });

  const updatePlexStreamSettings: SubmitHandler<PlexStreamSettings> = (
    streamSettings,
  ) => {
    updatePlexStreamingSettingsMutation.mutate({
      ...streamSettings,
      audioCodecs: streamSettings.audioCodecs
        .toString()
        .replace(/\s*,\s*/g, ',') //remove white spaces before/after comma
        .trim() // remove trailing whitespaces
        .split(',')
        .filter((value) => value.trim() !== ''), // handle empty value after commas
      videoCodecs: streamSettings.videoCodecs
        .toString()
        .replace(/\s*,\s*/g, ',') //remove white spaces before/after comma
        .trim() // remove trailing whitespaces
        .split(',')
        .filter((value) => value.trim() !== ''), // handle empty value after commas
    });
  };

  const [deletePlexConfirmation, setDeletePlexConfirmation] = useState<
    string | undefined
  >(undefined);

  const removePlexServerMutation = useMutation({
    mutationFn: (id: string) => {
      return apiClient.deletePlexServer(null, { params: { id } });
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
    },
  });

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (serversError || streamsError) {
    return <h1>XML: {(serversError ?? streamsError)!.message}</h1>;
  }

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={!!deletePlexConfirmation}
        onClose={() => setDeletePlexConfirmation(undefined)}
        aria-labelledby="delete-plex-server-title"
        aria-describedby="delete-plex-server-description"
      >
        <DialogTitle id="delete-plex-server-title">
          {'Delete Plex Server?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-plex-server-description">
            Deleting a Plex server will remove all programming from your
            channels associated with this plex server. Missing programming will
            be replaced with Flex time. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeletePlexConfirmation(undefined)}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            onClick={() => removePlexServer(deletePlexConfirmation!)}
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const removePlexServer = (id: string) => {
    removePlexServerMutation.mutate(id);
    setDeletePlexConfirmation(undefined);
  };

  const getTableRows = () => {
    return map(servers, (server) => {
      return <PlexServerRow key={server.id} server={server} />;
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
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              {/* <TableCell align="center">
                UI
                <Tooltip
                  placement="top"
                  title="The connection to Plex from the browser. Affects the ability to edit channel programming."
                >
                  <IconButton size="small" edge="end">
                    <HelpOutline sx={{ opacity: 0.75 }} />
                  </IconButton>
                </Tooltip>
              </TableCell> */}
              <TableCell align="center">
                Healthy?
                <Tooltip
                  placement="top"
                  title="The connection to Plex from the Tunarr server."
                >
                  <IconButton size="small" edge="end">
                    <HelpOutline sx={{ opacity: 0.75 }} />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell></TableCell>
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
          <Grid item xs={12} sm={6}>
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
      {renderConfirmationDialog()}
      <Box>
        <Box mb={2}>
          <Stack
            spacing={1}
            direction="row"
            useFlexGap
            sx={{ flexWrap: 'wrap' }}
          >
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Plex Servers
            </Typography>
            <AddPlexServer title="Discover" icon={AutoFixHigh} />
            <Button
              color="inherit"
              onClick={() => setPlexEditDialogOpen(true)}
              variant="contained"
              startIcon={<Add />}
            >
              Manual Add
            </Button>
            <Box sx={{ flexBasis: '100%', width: 0 }}></Box>
            <Typography variant="caption" sx={{ width: '60%' }}>
              Add Plex Servers as content sources for your channel. "Discover"
              will use the Plex login flow to discover servers associated with
              your account, however you can also manually add Plex server
              details using the "Manual Add" button.
            </Typography>
          </Stack>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 1 }}></Box>
          {renderServersTable()}
        </Box>
        <Typography component="h6" variant="h6" sx={{ mb: 2 }}>
          Plex Streaming
        </Typography>

        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="stream-path-label">Stream Path</InputLabel>
              <TypedController
                control={control}
                name="streamPath"
                render={({ field }) => (
                  <Select
                    labelId="stream-path-label"
                    id="stream-path"
                    sx={{ my: 1 }}
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
                <strong>Plex</strong>: This option will initialize the stream
                over the network, i.e. stream from the Plex server
                <br />
                <strong>Direct</strong>: This option attempts to open the file
                from the filesystem, using the file path provided by Plex. This
                path can be normalized for Tunarr using a find/replace string
                combination
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <CheckboxFormController
                    control={control}
                    name="updatePlayStatus"
                  />
                }
                label="Send play status to Plex"
              />
              <FormHelperText>
                Note: This affects the "on deck" for your plex account.
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
            {!_.isEqual(defaultValues, defaultPlexStreamSettings) && (
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
      <PlexServerEditDialog
        open={plexEditDialogOpen}
        onClose={() => setPlexEditDialogOpen(false)}
      />
    </Box>
  );
}
