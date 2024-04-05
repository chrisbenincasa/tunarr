import {
  AddCircle,
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
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  Input,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  SelectChangeEvent,
  Skeleton,
  Snackbar,
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
import { fill, isNil, isNull, isUndefined, map } from 'lodash-es';
import React, { useCallback, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import { RotatingLoopIcon } from '../../components/base/LoadingIcon.tsx';
import AddPlexServer from '../../components/settings/AddPlexServer.tsx';
import { apiClient } from '../../external/api.ts';
import {
  resolutionFromString,
  resolutionToString,
  toggle,
} from '../../helpers/util.ts';
import { usePlexServerStatus } from '../../hooks/plexHooks.ts';
import {
  usePlexServerSettings,
  usePlexStreamSettings,
} from '../../hooks/settingsHooks.ts';

const supportedResolutions = [
  '420x420',
  '576x320',
  '720x480',
  '1024x768',
  '1280x720',
  '1920x1080',
  '3840x2160',
];

const supportedAudioChannels = [
  '1.0',
  '2.0',
  '2.1',
  '4.0',
  '5.0',
  '5.1',
  '6.1',
  '7.1',
];

const supportedAudioBoost = [
  { value: 100, string: '0 Seconds' },
  { value: 120, string: '1 Second' },
  { value: 140, string: '2 Seconds' },
  { value: 160, string: '3 Seconds' },
  { value: 180, string: '4 Seconds' },
];

const supportedStreamProtocols = [
  { value: 'http', string: 'HTTP' },
  { value: 'hls', string: 'HLS' },
];

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
  const {
    data: servers,
    isPending: serversPending,
    error: serversError,
  } = usePlexServerSettings();

  const {
    data: streamSettings,
    isPending: streamSettingsPending,
    error: streamsError,
  } = usePlexStreamSettings();

  const queryClient = useQueryClient();

  const [deletePlexConfirmation, setDeletePlexConfirmation] = useState<
    string | undefined
  >(undefined);

  const [showSubtitles, setShowSubtitles] = useState<boolean>(
    defaultPlexStreamSettings.enableSubtitles,
  );

  const [audioBoost, setAudioBoost] = useState<number>(
    defaultPlexStreamSettings.audioBoost,
  );

  const [forceDirectPlay, setForceDirectPlay] = useState<boolean>(
    defaultPlexStreamSettings.forceDirectPlay,
  );

  const [debugLogging, setDebugLogging] = useState<boolean>(
    defaultPlexStreamSettings.enableDebugLogging,
  );

  const [playStatus, setPlayStatus] = useState<boolean>(
    defaultPlexStreamSettings.updatePlayStatus,
  );

  const [streamPath, setStreamPath] = useState<'plex' | 'direct'>(
    defaultPlexStreamSettings.streamPath,
  );

  const [videoCodecs, setVideoCodecs] = React.useState<string[]>(
    defaultPlexStreamSettings.videoCodecs,
  );

  const [addVideoCodecs, setAddVideoCodecs] = React.useState<string>('');

  const [audioCodecs, setAudioCodecs] = React.useState<string[]>(
    defaultPlexStreamSettings.audioCodecs,
  );

  const [addAudioCodecs, setAddAudioCodecs] = React.useState<string>('');

  const [maxAudioChannels, setMaxAudioChannels] = React.useState<string>(
    defaultPlexStreamSettings.maxAudioChannels,
  );

  const [maxDirectStreamBitrate, setMaxDirectStreamBitrate] = useState<string>(
    defaultPlexStreamSettings.directStreamBitrate.toString(),
  );

  const [pathReplace, setPathReplace] = React.useState<string>('');

  const [pathReplaceWith, setPathReplaceWith] = React.useState<string>('');

  const [streamProtocol, setStreamProtocol] = React.useState<string>('');

  const [transcodeBitrate, setTranscodeBitrate] = React.useState<string>('');

  const [mediaBufferSize, setMediaBufferSize] = React.useState<string>('');

  const [transcodeMediaBufferSize, setTranscodeMediaBufferSize] =
    React.useState<string>('');

  const [subtitleSize, setSubtitleSize] = React.useState<string>('');

  const handlePlexStreamingState = useCallback(() => {
    setVideoCodecs(
      streamSettings?.videoCodecs || defaultPlexStreamSettings.videoCodecs,
    );

    setMaxPlayableResolution(
      resolutionToString(
        streamSettings?.maxPlayableResolution ||
          defaultPlexStreamSettings.maxPlayableResolution,
      ),
    );

    setMaxTranscodeResolution(
      resolutionToString(
        streamSettings?.maxTranscodeResolution ||
          defaultPlexStreamSettings.maxTranscodeResolution,
      ),
    );

    setMaxDirectStreamBitrate(
      streamSettings?.directStreamBitrate.toString() ||
        defaultPlexStreamSettings.directStreamBitrate.toString(),
    );

    setAudioBoost(
      streamSettings?.audioBoost || defaultPlexStreamSettings.audioBoost,
    );

    setStreamPath(
      streamSettings?.streamPath || defaultPlexStreamSettings.streamPath,
    );

    setForceDirectPlay(
      streamSettings?.forceDirectPlay ||
        defaultPlexStreamSettings.forceDirectPlay,
    );

    setDebugLogging(
      streamSettings?.enableDebugLogging ||
        defaultPlexStreamSettings.enableDebugLogging,
    );

    setPlayStatus(
      streamSettings?.updatePlayStatus ||
        defaultPlexStreamSettings.updatePlayStatus,
    );

    setStreamProtocol(
      streamSettings?.streamProtocol ||
        defaultPlexStreamSettings.streamProtocol,
    );

    setAudioCodecs(
      streamSettings?.audioCodecs || defaultPlexStreamSettings.audioCodecs,
    );

    setMaxAudioChannels(
      streamSettings?.maxAudioChannels ||
        defaultPlexStreamSettings.maxAudioChannels,
    );

    setPathReplace(
      streamSettings?.pathReplace || defaultPlexStreamSettings.pathReplace,
    );

    setPathReplaceWith(
      streamSettings?.pathReplaceWith ||
        defaultPlexStreamSettings.pathReplaceWith,
    );

    setTranscodeBitrate(
      streamSettings?.transcodeBitrate.toString() ||
        defaultPlexStreamSettings.transcodeBitrate.toString(),
    );

    setMediaBufferSize(
      streamSettings?.mediaBufferSize.toString() ||
        defaultPlexStreamSettings.mediaBufferSize.toString(),
    );

    setTranscodeMediaBufferSize(
      streamSettings?.transcodeMediaBufferSize.toString() ||
        defaultPlexStreamSettings.transcodeMediaBufferSize.toString(),
    );

    setSubtitleSize(
      streamSettings?.subtitleSize.toString() ||
        defaultPlexStreamSettings.subtitleSize.toString(),
    );

    setShowSubtitles(
      streamSettings?.enableSubtitles ||
        defaultPlexStreamSettings.enableSubtitles,
    );
  }, [
    streamSettings?.audioCodecs,
    streamSettings?.audioBoost,
    streamSettings?.directStreamBitrate,
    streamSettings?.maxAudioChannels,
    streamSettings?.maxPlayableResolution,
    streamSettings?.maxTranscodeResolution,
    streamSettings?.mediaBufferSize,
    streamSettings?.transcodeBitrate,
    streamSettings?.transcodeMediaBufferSize,
    streamSettings?.videoCodecs,
    streamSettings?.subtitleSize,
    streamSettings?.enableSubtitles,
    streamSettings?.forceDirectPlay,
    streamSettings?.enableDebugLogging,
    streamSettings?.updatePlayStatus,
  ]);

  useEffect(() => {
    handlePlexStreamingState();
  }, [handlePlexStreamingState, streamSettings]);

  const handleVideoCodecUpdate = () => {
    if (!addVideoCodecs.length) {
      return;
    }

    // If there is a comma or white space at the end of user input, trim it
    let newVideoCodecs: string[] = [addVideoCodecs.replace(/,\s*$/, '')];

    if (addVideoCodecs?.indexOf(',') > -1) {
      newVideoCodecs = newVideoCodecs[0].split(',');
    } else {
      newVideoCodecs = [newVideoCodecs[0]];
    }

    setVideoCodecs([...videoCodecs, ...newVideoCodecs]);
    setAddVideoCodecs('');
  };

  const handleVideoCodecChange = (newVideoCodecs: string) => {
    setAddVideoCodecs(newVideoCodecs);
  };

  const handleAudioCodecUpdate = () => {
    if (!addAudioCodecs.length) {
      return;
    }

    // If there is a comma or white space at the end of user input, trim it
    let newAudioCodecs: string[] = [addAudioCodecs.replace(/,\s*$/, '')];

    if (addAudioCodecs?.indexOf(',') > -1) {
      newAudioCodecs = newAudioCodecs[0].split(',');
    } else {
      newAudioCodecs = [newAudioCodecs[0]];
    }

    setAudioCodecs([...audioCodecs, ...newAudioCodecs]);
    setAddAudioCodecs('');
  };

  const handleAudioCodecChange = (newAudioCodecs: string) => {
    setAddAudioCodecs(newAudioCodecs);
  };

  const handleAudioBoost = (event: SelectChangeEvent<number>) => {
    setAudioBoost(event.target.value as number); // We know this will be a number
  };

  const [maxPlayableResolution, setMaxPlayableResolution] = useState<string>(
    resolutionToString(defaultPlexStreamSettings.maxPlayableResolution),
  );

  const handleMaxPlayableResolution = (event: SelectChangeEvent<string>) => {
    setMaxPlayableResolution(event.target.value);
  };

  const [maxTranscodeResolution, setMaxTranscodeResolution] = useState<string>(
    resolutionToString(defaultPlexStreamSettings.maxTranscodeResolution),
  );

  const handleMaxTranscodeResolution = (event: SelectChangeEvent<string>) => {
    setMaxTranscodeResolution(event.target.value);
  };

  const handleStreamProtocol = (event: SelectChangeEvent<string>) => {
    setStreamProtocol(event.target.value);
  };

  const handleMaxDirectStreamBitrate = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setMaxDirectStreamBitrate(event.target.value);
  };

  const handleTranscodeBitrate = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setTranscodeBitrate(event.target.value);
  };

  const handleMediaBufferSize = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setMediaBufferSize(event.target.value);
  };

  const handleTranscodeMediaBufferSize = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setTranscodeMediaBufferSize(event.target.value);
  };

  const handleMaxAudioChannels = (event: SelectChangeEvent<string>) => {
    setMaxAudioChannels(event.target.value);
  };

  const onSubtitleChange = () => {
    setShowSubtitles(!showSubtitles);
  };

  const onDirectPlayChange = () => {
    setForceDirectPlay(!forceDirectPlay);
  };

  const onDebugLoggingChange = () => {
    setDebugLogging(!debugLogging);
  };

  const onPlayStatusChange = () => {
    setPlayStatus(!playStatus);
  };

  const handlePathChange = (event: SelectChangeEvent<'plex' | 'direct'>) => {
    setStreamPath(event.target.value as 'plex' | 'direct');
  };

  const handlePathReplace = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPathReplace(event.target.value);
  };

  const handlePathReplaceWith = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setPathReplaceWith(event.target.value);
  };

  const handleSubtitleSize = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSubtitleSize(event.target.value);
  };

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

  const [snackStatus, setSnackStatus] = React.useState<boolean>(false);

  const updatePlexStreamingSettingsMutation = useMutation({
    mutationFn: (updateSettings: PlexStreamSettings) => {
      return fetch('http://localhost:8000/api/plex-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateSettings),
      });
    },
    onSuccess: () => {
      setSnackStatus(true);
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-settings'],
      });
    },
  });

  // TO DO: Add All Fields and remove defaults
  // refactor
  const updatePlexStreamSettings = () => {
    const [maxPlayableResolutionWidth, maxPlayableResolutionHeight] =
      maxPlayableResolution.split('x', 2);
    const [maxTranscodeResolutionWidth, maxTranscodeResolutionHeight] =
      maxTranscodeResolution.split('x', 2);

    // This is temporary until I have all fields
    const allPlexStreamFieldValues = {
      ...defaultPlexStreamSettings,
      ...{
        audioCodecs,
        audioBoost,
        directStreamBitrate: Number(maxDirectStreamBitrate),
        enableSubtitles: showSubtitles,
        maxAudioChannels,
        maxPlayableResolution: resolutionFromString(
          resolutionToString({
            widthPx: Number(maxPlayableResolutionWidth),
            heightPx: Number(maxPlayableResolutionHeight),
          }),
        ),
        maxTranscodeResolution: resolutionFromString(
          resolutionToString({
            widthPx: Number(maxTranscodeResolutionWidth),
            heightPx: Number(maxTranscodeResolutionHeight),
          }),
        ),
        mediaBufferSize: Number(mediaBufferSize),
        subtitleSize: Number(subtitleSize),
        transcodeBitrate: Number(transcodeBitrate),
        transcodeMediaBufferSize: Number(transcodeMediaBufferSize),
        videoCodecs,
        forceDirectPlay,
        enableDebugLogging: debugLogging,
        updatePlayStatus: playStatus,
        streamPath,
        pathReplace,
        pathReplaceWith,
        streamProtocol,
      },
    };

    updatePlexStreamingSettingsMutation.mutate(allPlexStreamFieldValues);
  };

  const handleResetOptions = () => {
    updatePlexStreamingSettingsMutation.mutate({
      ...defaultPlexStreamSettings,
    });
    handlePlexStreamingState();
  };

  const removeVideoCodec = (codecToDelete: string) => () => {
    setVideoCodecs(
      (codecs) => codecs?.filter((codec) => codec !== codecToDelete),
    );
  };

  const removeAudioCodec = (codecToDelete: string) => () => {
    setAudioCodecs(
      (codecs) => codecs?.filter((codec) => codec !== codecToDelete),
    );
  };

  const handleSnackClose = () => {
    setSnackStatus(false);
  };

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (serversError || streamsError) {
    return <h1>XML: {(serversError ?? streamsError)!.message}</h1>;
  }

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

  const renderStreamSettings = () => {
    if (streamSettingsPending) {
      return (
        <Paper sx={{ display: 'flex' }}>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
        </Paper>
      );
    }

    if (!streamSettings) {
      return <div>Error</div>;
    }

    return (
      <>
        <Divider sx={{ my: 3 }} />
        <Typography component="h6" sx={{ my: 2 }}>
          Video Options
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel htmlFor="add-video-codec">Video Codecs</InputLabel>
              <Input
                id="add-video-codec"
                type={'text'}
                value={addVideoCodecs}
                onChange={(event) => handleVideoCodecChange(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVideoCodecUpdate();
                  }
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Add Video Codec"
                      onClick={handleVideoCodecUpdate}
                    >
                      <AddCircle />
                    </IconButton>
                  </InputAdornment>
                }
              />
            </FormControl>

            {videoCodecs?.map((codec) => (
              <Chip
                label={codec}
                key={codec}
                onDelete={removeVideoCodec(codec)}
                sx={{ mr: 1, mt: 1 }}
              />
            ))}
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="max-playable-resolution">
                Max Playable Resolution
              </InputLabel>
              <Select
                labelId="max-playable-resolution"
                id="max-playable-resolution"
                label="Max Playable Resolution"
                value={maxPlayableResolution}
                onChange={handleMaxPlayableResolution}
              >
                {supportedResolutions.map((res) => (
                  <MenuItem key={res} value={res}>
                    {res}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="max-transcode-resolution">
                Max Transcode Resolution
              </InputLabel>
              <Select
                labelId="max-transcode-resolution"
                id="max-transcode-resolution"
                label="Max Transcode Resolution"
                value={maxTranscodeResolution}
                onChange={handleMaxTranscodeResolution}
              >
                {supportedResolutions.map((res) => (
                  <MenuItem key={res} value={res}>
                    {res}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

  const renderAudioSettings = () => {
    if (streamSettingsPending) {
      return (
        <Paper sx={{ display: 'flex' }}>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
        </Paper>
      );
    }

    if (!streamSettings) {
      return <div>Error</div>;
    }

    return (
      <>
        <Divider sx={{ my: 3 }} />
        <Typography component="h6" sx={{ my: 2 }}>
          Audio Options
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel htmlFor="add-audio-codec">Audio Codecs</InputLabel>
              <Input
                id="add-audio-codec"
                type={'text'}
                value={addAudioCodecs}
                onChange={(event) => handleAudioCodecChange(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleAudioCodecUpdate();
                  }
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="Add Audio Codec"
                      onClick={handleAudioCodecUpdate}
                    >
                      <AddCircle />
                    </IconButton>
                  </InputAdornment>
                }
              />
            </FormControl>
            {audioCodecs.map((codec) => (
              <Chip
                label={codec}
                key={codec}
                onDelete={removeAudioCodec(codec)}
                sx={{ mr: 1, mt: 1 }}
              />
            ))}
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="maximum-audio-channels-label">
                Maxium Audio Channels
              </InputLabel>
              <Select
                labelId="maximum-audio-channels-label"
                id="maximum-audio-channels"
                label="Maxium Audio Channels"
                value={maxAudioChannels}
                onChange={handleMaxAudioChannels}
              >
                {supportedAudioChannels.map((res) => (
                  <MenuItem key={res} value={res}>
                    {res}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Note: 7.1 audio and on some clients, 6.1, is known to cause
                playback issues.
              </FormHelperText>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel id="audio-boost-label">Audio Boost</InputLabel>
              <Select
                labelId="audio-boost-label"
                id="audio-boost"
                label="Audio Boost"
                value={audioBoost}
                onChange={handleAudioBoost}
              >
                {supportedAudioBoost.map((boost) => (
                  <MenuItem key={boost.value} value={boost.value}>
                    {boost.string}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>
                Note: Only applies when downmixing to stereo.
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

  const renderSubtitleSettings = () => {
    if (streamSettingsPending) {
      return (
        <Paper sx={{ display: 'flex' }}>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
        </Paper>
      );
    }

    if (!streamSettings) {
      return <div>Error</div>;
    }

    return (
      <>
        <Divider sx={{ my: 3 }} />
        <Typography component="h6" sx={{ my: 2 }}>
          Subtitle Options
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={onSubtitleChange}
                    checked={showSubtitles}
                  />
                }
                label="Enable Subtitles (Requires Transcoding)"
              />
              {showSubtitles && (
                <TextField
                  id="component-outlined"
                  label="Subtitle Size"
                  onChange={handleSubtitleSize}
                  value={subtitleSize}
                />
              )}
            </FormControl>
          </Grid>
        </Grid>
      </>
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
              <TextField
                label="Original Plex path to replace:"
                value={pathReplace}
                onChange={handlePathReplace}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Replace Plex path with:"
                value={pathReplaceWith}
                onChange={handlePathReplaceWith}
              />
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

  const renderMiscSettings = () => {
    if (streamSettingsPending) {
      return (
        <Paper sx={{ display: 'flex' }}>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
          <Box flex={1}>
            <Skeleton width="70%">
              <TextField fullWidth />
            </Skeleton>
          </Box>
        </Paper>
      );
    }

    if (!streamSettings) {
      return <div>Error</div>;
    }

    return (
      <>
        <Divider sx={{ my: 3 }} />
        <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
          Miscellaneous Options
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Max Direct Stream Bitrate (Kbps)"
                onChange={handleMaxDirectStreamBitrate}
                value={maxDirectStreamBitrate}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Max Transcode Bitrate (Kbps)"
                onChange={handleTranscodeBitrate}
                value={transcodeBitrate}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Direct Stream Media Buffer Size"
                onChange={handleMediaBufferSize}
                value={mediaBufferSize}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Transcode Media Buffer Size"
                onChange={handleTranscodeMediaBufferSize}
                value={transcodeMediaBufferSize}
              />
            </FormControl>
            <FormControl fullWidth>
              <InputLabel id="stream-protocol-label">
                Stream Protocol
              </InputLabel>
              <Select
                labelId="stream-protocol-label"
                id="stream-protocol"
                label="Stream Protocol"
                value={streamProtocol}
                onChange={handleStreamProtocol}
              >
                {supportedStreamProtocols.map((protocol) => (
                  <MenuItem key={protocol.value} value={protocol.value}>
                    {protocol.string}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={onDirectPlayChange}
                    checked={forceDirectPlay}
                  />
                }
                label="Force Direct Play"
              />
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

  return (
    <>
      <Snackbar
        open={snackStatus}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message="Settings Saved!"
      />
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
        <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
          Plex Transcoding
        </Typography>
        <Alert severity="info" sx={{ my: 1 }}>
          If stream changes video codec, audio codec, or audio channels upon
          episode change, you will experience playback issues unless ffmpeg
          transcoding and normalization are also enabled.
        </Alert>

        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="stream-path-label">Stream Path</InputLabel>
              <Select
                labelId="stream-path-label"
                id="stream-path"
                label="Stream Path"
                value={streamPath}
                onChange={handlePathChange}
              >
                {supportedPaths.map((path) => (
                  <MenuItem key={path.value} value={path.value}>
                    {path.string}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={onDebugLoggingChange}
                    checked={debugLogging}
                  />
                }
                label="Debug Logging"
              />
            </FormControl>
            <FormControl fullWidth>
              <FormControlLabel
                control={
                  <Checkbox
                    onChange={onPlayStatusChange}
                    checked={playStatus}
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
          {streamPath === 'plex' ? (
            <>
              {renderStreamSettings()}
              {renderAudioSettings()}
              {renderSubtitleSettings()}
              {renderMiscSettings()}
            </>
          ) : (
            renderPathReplacements()
          )}
        </Box>
        <Stack
          spacing={2}
          direction="row"
          justifyContent="right"
          sx={{ mt: 2 }}
        >
          <Button variant="outlined" onClick={() => handleResetOptions()}>
            Reset Options
          </Button>
          <Button
            variant="contained"
            onClick={() => updatePlexStreamSettings()}
          >
            Save
          </Button>
        </Stack>
      </Box>
    </>
  );
}
