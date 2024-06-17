import {
  CancelOutlined,
  CloudDoneOutlined,
  CloudOff,
  Delete,
  Edit,
  HelpOutline,
  Save,
  Visibility,
  VisibilityOff,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Checkbox,
  Collapse,
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
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  OutlinedInput,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PlexServerSettings,
  PlexStreamSettings,
  defaultPlexStreamSettings,
} from '@tunarr/types';
import _, { fill, isNil, isNull, isUndefined, map } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { RotatingLoopIcon } from '../../components/base/LoadingIcon.tsx';
import AddPlexServer from '../../components/settings/AddPlexServer.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  CheckboxFormController,
  TypedController,
} from '../../components/util/TypedController.tsx';
import { toggle } from '../../helpers/util.ts';
import { usePlexServerStatus } from '../../hooks/plex/usePlexServerStatus.ts';
import {
  usePlexServerSettings,
  usePlexStreamSettings,
} from '../../hooks/settingsHooks.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

const supportedPaths = [
  { value: 'plex', string: 'Plex' },
  { value: 'direct', string: 'Direct' },
];

type PlexServerDeleteDialogProps = {
  open: boolean;
  onClose: () => void;
  serverId: string;
};

function PlexServerDeleteDialog({
  open,
  onClose,
  serverId,
}: PlexServerDeleteDialogProps) {
  const apiClient = useTunarrApi();
  const queryClient = useQueryClient();
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

  const titleId = `delete-plex-server-${serverId}-title`;
  const descId = `delete-plex-server-${serverId}-description`;

  return (
    <Dialog open={open} aria-labelledby={titleId} aria-describedby={descId}>
      <DialogTitle id={titleId}>Delete Plex Server?</DialogTitle>
      <DialogContent>
        <DialogContentText id={descId}>
          Deleting a Plex server will remove all programming from your channels
          associated with this plex server. Missing programming will be replaced
          with Flex time. This action cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} autoFocus>
          Cancel
        </Button>
        <Button
          onClick={() => removePlexServerMutation.mutate(serverId)}
          variant="contained"
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}

type PlexServerRowProps = {
  server: PlexServerSettings;
  // isEditing: boolean,
};

function PlexServerRow({ server }: PlexServerRowProps) {
  const apiClient = useTunarrApi();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showAccessToken, setShowAccessToken] = useState(false);
  const {
    data: uiStatus,
    isLoading: uisStatusLoading,
    error: uiStatusError,
  } = usePlexServerStatus(server);
  const {
    data: backendStatus,
    isLoading: backendStatusLoading,
    error: backendStatusError,
  } = useQuery({
    queryKey: ['plex-servers', server.id, 'status'],
    queryFn: () => apiClient.getPlexServerStatus({ params: { id: server.id } }),
    staleTime: 1000 * 60 * 5,
  });

  const uiHealthy = isNull(uiStatusError) && !isUndefined(uiStatus) && uiStatus;
  const backendHealthy =
    isNull(backendStatusError) &&
    !isUndefined(backendStatus) &&
    backendStatus.healthy;

  const queryClient = useQueryClient();

  const {
    reset,
    control,
    formState: { isValid },
    handleSubmit,
  } = useForm<Omit<PlexServerSettings, 'id'>>({
    mode: 'onChange',
    defaultValues: {
      accessToken: '',
      index: 0,
      name: '',
      sendChannelUpdates: false,
      sendGuideUpdates: false,
      uri: '',
    },
  });

  const updatePlexServerMutation = useMutation({
    mutationFn: (updatedServer: PlexServerSettings) => {
      return apiClient.updatePlexServer(updatedServer, {
        params: { id: updatedServer.id },
      });
    },
    onSuccess: () => {
      setIsEditing(false);
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
    },
  });

  const savePlexServer: SubmitHandler<Omit<PlexServerSettings, 'id'>> =
    useCallback(
      (data) => {
        if (isEditing) {
          updatePlexServerMutation.mutate({ id: server.id, ...data });
        }
      },
      [isEditing, server, updatePlexServerMutation],
    );

  useEffect(() => {
    reset(server);
  }, []);

  return (
    <>
      <TableRow>
        <TableCell>{server.name}</TableCell>
        <TableCell width="60%">
          {!isEditing ? (
            <Link href={server.uri} target={'_blank'}>
              {server.uri}
            </Link>
          ) : (
            <Controller
              control={control}
              name="uri"
              rules={{ required: true, minLength: 1 }}
              render={({ field, formState: { errors } }) => (
                <TextField
                  label="URL"
                  size="small"
                  fullWidth
                  error={!isNil(errors.uri)}
                  {...field}
                  helperText={errors.uri?.message ?? null}
                />
              )}
            />
          )}
        </TableCell>
        <TableCell align="center">
          {uisStatusLoading ? (
            <RotatingLoopIcon />
          ) : uiHealthy ? (
            <CloudDoneOutlined color="success" />
          ) : (
            <CloudOff color="error" />
          )}
        </TableCell>
        <TableCell align="center">
          {backendStatusLoading ? (
            <RotatingLoopIcon />
          ) : backendHealthy ? (
            <CloudDoneOutlined color="success" />
          ) : (
            <CloudOff color="error" />
          )}
        </TableCell>
        <TableCell width="10%" align="right">
          {isEditing ? (
            <>
              <IconButton
                color="primary"
                disabled={!isValid}
                onClick={handleSubmit(savePlexServer)}
              >
                <Save />
              </IconButton>
              <IconButton color="primary" onClick={() => setIsEditing(false)}>
                <CancelOutlined />
              </IconButton>
            </>
          ) : (
            <>
              <IconButton color="primary" onClick={() => setIsEditing(true)}>
                <Edit />
              </IconButton>
              <IconButton
                color="primary"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Delete />
              </IconButton>
            </>
          )}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell
          sx={{ py: 0, borderBottom: isEditing ? null : 0 }}
          colSpan={6}
        >
          <Collapse in={isEditing} timeout="auto" unmountOnExit>
            <Stack
              direction="row"
              spacing={2}
              useFlexGap
              sx={{ m: 1, display: 'flex', alignItems: 'center' }}
            >
              <Controller
                control={control}
                name="accessToken"
                rules={{
                  required: true,
                  minLength: 1,
                }}
                render={({ field, formState: { errors } }) => (
                  <FormControl sx={{ m: 1, width: '25ch' }} variant="outlined">
                    <InputLabel htmlFor="access-token" size="small">
                      Access Token
                    </InputLabel>
                    <OutlinedInput
                      size="small"
                      id="access-token"
                      type={showAccessToken ? 'text' : 'password'}
                      endAdornment={
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle access token visibility"
                            onClick={() => setShowAccessToken(toggle)}
                            edge="end"
                          >
                            {showAccessToken ? (
                              <VisibilityOff />
                            ) : (
                              <Visibility />
                            )}
                          </IconButton>
                        </InputAdornment>
                      }
                      label="Access Token"
                      {...field}
                    />
                    {errors.accessToken && (
                      <FormHelperText>
                        {errors.accessToken.message}
                      </FormHelperText>
                    )}
                  </FormControl>
                )}
              />
              <FormControl>
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
            </Stack>
          </Collapse>
        </TableCell>
      </TableRow>
      <PlexServerDeleteDialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        serverId={server.id}
      />
    </>
  );
}

export default function PlexSettingsPage() {
  const apiClient = useTunarrApi();
  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);

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
              <TableCell align="center">
                UI
                <Tooltip
                  placement="top"
                  title="The connection to Plex from the browser. Affects the ability to edit channel programming."
                >
                  <IconButton size="small" edge="end">
                    <HelpOutline sx={{ opacity: 0.75 }} />
                  </IconButton>
                </Tooltip>
              </TableCell>
              <TableCell align="center">
                Backend
                <Tooltip
                  placement="top"
                  title="The connection to Plex from the server. Affects the ability to stream."
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
          <Box sx={{ display: 'flex', mb: 2 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Plex Servers
            </Typography>
            <AddPlexServer />
          </Box>
          {renderServersTable()}
        </Box>
        <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 2 }}>
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
                    name="enableDebugLogging"
                  />
                }
                label="Debug Logging"
              />
            </FormControl>
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
    </Box>
  );
}
