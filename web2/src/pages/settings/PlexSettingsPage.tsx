import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import Done from '@mui/icons-material/Done';
import {
  Alert,
  Box,
  Button,
  Chip,
  Checkbox,
  FormControl,
  FormControlLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Paper,
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
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PlexServerInsert } from 'dizquetv-types';
import { fill } from 'lodash-es';
import { checkNewPlexServers, plexLoginFlow } from '../../helpers/plexLogin.ts';
import {
  usePlexServerSettings,
  usePlexStreamSettings,
} from '../../hooks/settingsHooks.ts';
import { toStringResolution } from '../../helpers/util.ts';
import { Close } from '@mui/icons-material';
import { useState } from 'react';

const supportedResolutions = [
  '420x420',
  '576x320',
  '720x480',
  '1024x768',
  '1280x720',
  '1920x1080',
  '3840x2160',
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

  const [showSubtitles, setShowSubtitles] = useState(false);
  const onSubtitleChange = () => {
    setShowSubtitles(!showSubtitles);
  };
  const addPlexServerMutation = useMutation({
    mutationFn: (newServer: PlexServerInsert) => {
      return fetch('http://localhost:8000/api/plex-servers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newServer),
      });
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['settings', 'plex-servers'],
      });
    },
  });

  const removeVideoCodec = (codec: Text) => {
    console.log(codec); // TODO
  };

  const removeAudioCodec = (codec: Text) => {
    console.log(codec); // TODO
  };

  const UIRouteSuccess = true; // TODO
  const backendRouteSuccess = true; // TODO

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (serversError || streamsError) {
    return <h1>XML: {(serversError ?? streamsError)!.message}</h1>;
  }

  const addPlexServer = () => {
    plexLoginFlow()
      .then(checkNewPlexServers)
      .then((connections) => {
        connections.forEach(({ server, connection }) =>
          addPlexServerMutation.mutate({
            name: server.name,
            uri: connection.uri,
            accessToken: server.accessToken,
          }),
        );
      })
      .catch(console.error);
  };

  const getTableRows = () => {
    return servers!.map((server) => (
      <TableRow key={server.name}>
        <TableCell>{server.name}</TableCell>
        <TableCell>
          <Link href={server.uri} target={'_blank'}>
            {server.uri}
          </Link>
        </TableCell>
        <TableCell align="center">
          {UIRouteSuccess ? <Done color="success" /> : <Close color="error" />}
        </TableCell>
        <TableCell align="center">
          {backendRouteSuccess ? (
            <Done color="success" />
          ) : (
            <Close color="error" />
          )}
        </TableCell>
        <TableCell width="10%" align="right">
          <IconButton color="primary">
            <EditIcon />
          </IconButton>
        </TableCell>
      </TableRow>
    ));
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
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell align="center">UI Route</TableCell>
              <TableCell align="center">Backend Route</TableCell>
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
              <TextField
                id="component-outlined"
                label="Video Codecs"
                defaultValue={streamSettings?.videoCodecs}
              />
            </FormControl>

            {streamSettings.videoCodecs.map((codec) => (
              <Chip
                label={codec}
                key={codec}
                onDelete={(codec) => removeVideoCodec(codec)}
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
                value={toStringResolution(streamSettings.maxPlayableResolution)}
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
                defaultValue={streamSettings.directStreamBitrate}
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
              <TextField
                id="component-outlined"
                label="Audio Codecs"
                defaultValue={streamSettings?.audioCodecs}
              />
            </FormControl>
            {streamSettings.audioCodecs.map((codec) => (
              <Chip
                label={codec}
                key={codec}
                onDelete={(codec) => removeAudioCodec(codec)}
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
                value={streamSettings.maxAudioChannels}
              >
                <MenuItem value={1}>1.0</MenuItem>
                <MenuItem value={2}>2.0</MenuItem>
                <MenuItem value={2.1}>2.1</MenuItem>
                <MenuItem value={4}>4.0</MenuItem>
                <MenuItem value={5}>5.0</MenuItem>
                <MenuItem value={5.1}>5.1</MenuItem>
                <MenuItem value={6.1}>6.1</MenuItem>
                <MenuItem value={7.1}>7.1</MenuItem>
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
                <MenuItem value={100}>0 Seconds</MenuItem>
                <MenuItem value={120}>1 Second</MenuItem>
                <MenuItem value={140}>2 Seconds</MenuItem>
                <MenuItem value={160}>3 Seconds</MenuItem>
                <MenuItem value={180}>4 Seconds</MenuItem>
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
                id="component-outlined"
                label="Max Direct Stream Bitrate (Kbps)"
                defaultValue={streamSettings?.directStreamBitrate}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                id="component-outlined"
                label="Max Transcode Bitrate (Kbps)"
                defaultValue={streamSettings?.transcodeBitrate}
              />
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                id="component-outlined"
                label="Direct Stream Media Buffer Size"
                defaultValue={streamSettings?.mediaBufferSize}
              />
            </FormControl>
            <FormControl fullWidth sx={{ my: 1 }}>
              <TextField
                id="component-outlined"
                label="Transcode Media Buffer Size"
                defaultValue={streamSettings?.transcodeMediaBufferSize}
              />
            </FormControl>
          </Grid>
        </Grid>
      </>
    );
  };

  return (
    <Box>
      <Box mb={2}>
        <Box sx={{ display: 'flex', mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Plex Servers
          </Typography>
          <Button
            onClick={() => addPlexServer()}
            variant="contained"
            startIcon={<AddCircleIcon />}
          >
            Add
          </Button>
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
      <Paper sx={{ display: 'block', p: 2 }}>
        {renderStreamSettings()}
        {renderAudioSettings()}
        {renderSubtitleSettings()}
      </Paper>
      <Typography component="h6" variant="h6" sx={{ pt: 2, pb: 1 }}>
        Miscellaneous Options
      </Typography>
      <Paper>{renderMiscSettings()}</Paper>
      <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
        <Button variant="outlined">Reset Options</Button>
        <Button variant="contained">Save</Button>
      </Stack>
    </Box>
  );
}
