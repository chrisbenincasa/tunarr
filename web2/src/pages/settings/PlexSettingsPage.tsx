import {
  Box,
  IconButton,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { usePlexSettings } from '../../hooks/settingsHooks.ts';
import EditIcon from '@mui/icons-material/Edit';

export default function PlexSettingsPage() {
  const { servers, streamSettings, isPending, error } = usePlexSettings();

  // This is messy, lets consider getting rid of combine, it probably isnt useful here
  if (isPending) {
    return <h1>XML: Loading...</h1>;
  } else if (error) {
    return <h1>XML: {error.message}</h1>;
  } else if (!isPending && !error && (!servers || !streamSettings)) {
    return <h1>Error</h1>;
  }

  console.log(servers, streamSettings);

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

  return (
    <Box>
      <Box mb={2}>
        <Typography component="h4" variant="h4" sx={{ pb: 2 }}>
          Plex Servers
        </Typography>
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
            <TableBody>{getTableRows()}</TableBody>
          </Table>
        </TableContainer>
      </Box>
      <Typography component="h4" variant="h4" sx={{ pt: 2, pb: 1 }}>
        Plex Transcoding
      </Typography>
    </Box>
  );
}
