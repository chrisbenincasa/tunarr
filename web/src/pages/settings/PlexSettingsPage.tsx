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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PlexServerSettings,
  PlexStreamSettings,
  defaultPlexStreamSettings,
} from '@tunarr/types';
import { fill, isNil, isNull, isUndefined } from 'lodash-es';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import AddPlexServer from '../../components/settings/AddPlexServer.tsx';
import { apiClient } from '../../external/api.ts';
import {
  resolutionFromString,
  resolutionToString,
  toggle,
} from '../../helpers/util.ts';
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

  const [currentEditRow, setCurrentEditRow] = useState<number | null>(null);
  const [showAccessToken, setShowAccessToken] = useState(false);

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

  useEffect(() => {
    if (
      !isNull(currentEditRow) &&
      !isUndefined(servers) &&
      servers.length > currentEditRow
    ) {
      reset(servers[currentEditRow]);
    }
  }, [currentEditRow, servers, reset]);

  const [deletePlexConfirmation, setDeletePlexConfirmation] = useState<
    string | undefined
  >(undefined);

  const [showSubtitles, setShowSubtitles] = useState<boolean>(
    defaultPlexStreamSettings.enableSubtitles,
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

  const [directStreamBitrate, setDirectStreamBitrate] =
    React.useState<string>('');

  const [transcodeBitrate, setTranscodeBitrate] = React.useState<string>('');

  const [mediaBufferSize, setMediaBufferSize] = React.useState<string>('');

  const [transcodeMediaBufferSize, setTranscodeMediaBufferSize] =
    React.useState<string>('');

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

    setMaxDirectStreamBitrate(
      streamSettings?.directStreamBitrate.toString() ||
        defaultPlexStreamSettings.directStreamBitrate.toString(),
    );

    setAudioCodecs(
      streamSettings?.audioCodecs || defaultPlexStreamSettings.audioCodecs,
    );

    setMaxAudioChannels(
      streamSettings?.maxAudioChannels ||
        defaultPlexStreamSettings.maxAudioChannels,
    );

    setDirectStreamBitrate(
      streamSettings?.directStreamBitrate.toString() ||
        defaultPlexStreamSettings.directStreamBitrate.toString(),
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
  }, [
    streamSettings?.audioCodecs,
    streamSettings?.directStreamBitrate,
    streamSettings?.maxAudioChannels,
    streamSettings?.maxPlayableResolution,
    streamSettings?.mediaBufferSize,
    streamSettings?.transcodeBitrate,
    streamSettings?.transcodeMediaBufferSize,
    streamSettings?.videoCodecs,
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

  const [maxPlayableResolution, setMaxPlayableResolution] = useState<string>(
    resolutionToString(defaultPlexStreamSettings.maxPlayableResolution),
  );

  const handleMaxPlayableResolution = (event: SelectChangeEvent<string>) => {
    setMaxPlayableResolution(event.target.value);
  };

  const [maxDirectStreamBitrate, setMaxDirectStreamBitrate] = useState<string>(
    defaultPlexStreamSettings.directStreamBitrate.toString(),
  );

  const handleMaxDirectStreamBitrate = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setMaxDirectStreamBitrate(event.target.value);
  };

  const handleMaxAudioChannels = (event: SelectChangeEvent<string>) => {
    setMaxAudioChannels(event.target.value);
  };

  const onSubtitleChange = () => {
    setShowSubtitles(!showSubtitles);
  };

  const updatePlexServerMutation = useMutation({
    mutationFn: (updatedServer: PlexServerSettings) => {
      return apiClient.updatePlexServer(updatedServer, {
        params: { id: updatedServer.id },
      });
    },
    onSuccess: () => {
      setCurrentEditRow(null);
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
    },
  });

  const savePlexServer: SubmitHandler<Omit<PlexServerSettings, 'id'>> =
    useCallback(
      (data) => {
        if (
          !isNull(currentEditRow) &&
          !isUndefined(servers) &&
          servers.length > currentEditRow
        ) {
          const originalServer = servers[currentEditRow];
          updatePlexServerMutation.mutate({ id: originalServer.id, ...data });
        }
      },
      [currentEditRow, servers, updatePlexServerMutation],
    );

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
    const [h, w] = maxPlayableResolution.split('x', 2);

    // This is temporary until I have all fields
    const allPlexStreamFieldValues = {
      ...defaultPlexStreamSettings,
      ...{
        audioCodecs,
        directStreamBitrate: Number(directStreamBitrate),
        enableSubtitles: showSubtitles,
        maxAudioChannels,
        maxPlayableResolution: resolutionFromString(
          resolutionToString({ widthPx: Number(w), heightPx: Number(h) }),
        ),
        mediaBufferSize: Number(mediaBufferSize),
        subtitleSize: 100,
        transcodeBitrate: Number(transcodeBitrate),
        transcodeMediaBufferSize: Number(transcodeMediaBufferSize),
        videoCodecs,
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

  const handleEditServer = useCallback(
    (index: number) => {
      setCurrentEditRow(index);
      setShowAccessToken(false);
    },
    [setCurrentEditRow, setShowAccessToken],
  );

  const UIRouteSuccess = true; // TODO
  const backendRouteSuccess = true; // TODO

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (serversError || streamsError) {
    return <h1>XML: {(serversError ?? streamsError)!.message}</h1>;
  }

  const removePlexServer = (id: string) => {
    removePlexServerMutation.mutate(id);
    setDeletePlexConfirmation(undefined);
  };

  const getTableRows = () => {
    return servers!.map((server, index) => {
      const isEditing = index === currentEditRow;
      return (
        <Fragment key={server.name}>
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
              {UIRouteSuccess ? (
                <CloudDoneOutlined color="success" />
              ) : (
                <CloudOff color="error" />
              )}
            </TableCell>
            <TableCell align="center">
              {backendRouteSuccess ? (
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
                  <IconButton
                    color="primary"
                    onClick={() => setCurrentEditRow(null)}
                  >
                    <CancelOutlined />
                  </IconButton>
                </>
              ) : (
                <>
                  <IconButton
                    color="primary"
                    onClick={() => handleEditServer(index)}
                  >
                    <Edit />
                  </IconButton>
                  <IconButton
                    color="primary"
                    onClick={() => setDeletePlexConfirmation(server.id)}
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
                      <FormControl
                        sx={{ m: 1, width: '25ch' }}
                        variant="outlined"
                      >
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
        </Fragment>
      );
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
            <FormControl fullWidth>
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
          </Grid>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <TextField
                value={maxDirectStreamBitrate}
                onChange={handleMaxDirectStreamBitrate}
                label="Max Direct Stream Bitrate (Kbps)"
              />
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
                value={streamSettings.audioBoost}
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
        <Typography component="h6" sx={{ my: 2 }}>
          Subtitle Options
        </Typography>
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <FormControlLabel
                control={<Checkbox onChange={onSubtitleChange} />}
                label="Enable Subtitles (Requires Transcoding)"
              />
              {showSubtitles && (
                <TextField
                  id="component-outlined"
                  label="Subtitle Size"
                  defaultValue={streamSettings?.subtitleSize}
                />
              )}
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
        <Grid flex="1 0 50%" container spacing={3}>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Max Direct Stream Bitrate (Kbps)"
                value={directStreamBitrate}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Max Transcode Bitrate (Kbps)"
                value={transcodeBitrate}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Direct Stream Media Buffer Size"
                value={mediaBufferSize}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                label="Transcode Media Buffer Size"
                value={transcodeMediaBufferSize}
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
        <Box sx={{ display: 'block', p: 2 }}>
          {renderStreamSettings()}
          {renderAudioSettings()}
          {renderSubtitleSettings()}
        </Box>
        <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
          Miscellaneous Options
        </Typography>
        <Box>{renderMiscSettings()}</Box>
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
