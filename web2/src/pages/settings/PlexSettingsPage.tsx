import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Paper,
  Select,
  Skeleton,
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
import { PlexServerInsert, Resolution } from 'dizquetv-types';
import { fill } from 'lodash-es';
import { checkNewPlexServers, plexLoginFlow } from '../../helpers/plexLogin.ts';
import {
  usePlexServerSettings,
  usePlexStreamSettings,
} from '../../hooks/settingsHooks.ts';

const toStringResolution = (res: Resolution) =>
  `${res.widthPx}x${res.heightPx}` as const;
const fromStringResolution = (res: `${number}x${number}`): Resolution => {
  const [h, w] = res.split('x', 1);
  return { widthPx: parseInt(w), heightPx: parseInt(h) };
};

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
        <TableCell>OK</TableCell>
        <TableCell>OK</TableCell>
        <TableCell width="10%">
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
              <TableCell>UI Route</TableCell>
              <TableCell>Backend Route</TableCell>
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
        <Paper sx={{ display: 'flex', p: 2 }}>
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
      <Paper sx={{ display: 'flex', p: 2 }}>
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
              <Chip label={codec} key={codec} />
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
        <Box>
          <FormControl></FormControl>
          <FormControl>
            <TextField defaultValue={streamSettings.audioCodecs} />
          </FormControl>
          <FormControl></FormControl>
        </Box>
      </Paper>
    );
  };

  return (
    <Box>
      <Box mb={2}>
        <Box sx={{ display: 'flex', mb: 2 }}>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
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
      <Typography component="h4" variant="h4" sx={{ pt: 2, pb: 1 }}>
        Plex Transcoding
      </Typography>
      {renderStreamSettings()}
    </Box>
  );
}
