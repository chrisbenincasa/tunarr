import { Edit } from '@mui/icons-material';
import {
  Box,
  Card,
  CardActions,
  CardContent,
  CardProps,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { Link as RouterLink } from '@tanstack/react-router';
import plexSvg from '../../assets/plex.svg';
import { usePlexServerSettings } from '../../hooks/settingsHooks.ts';
import AddPlexServer from './AddPlexServer.tsx';

export default function ConnectPlex(props: CardProps) {
  const {
    sx = {
      py: 2,
      margin: '0 auto',
      textAlign: 'center',
    },
    ...restProps
  } = props;

  const { data: plexServers } = usePlexServerSettings();
  const isPlexConnected = plexServers && plexServers.length > 0;
  const title = isPlexConnected ? 'Add Plex Library' : 'Connect Plex Now';

  return (
    <Box sx={sx} {...restProps}>
      <Card raised>
        <CardContent>
          {!isPlexConnected && (
            <>
              <img src={plexSvg} width="75" />
            </>
          )}

          {isPlexConnected ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell></TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Edit</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {plexServers.map((server) => {
                    return (
                      <TableRow key={server.id}>
                        <TableCell sx={{ maxWidth: 25 }}>
                          <img src={plexSvg} width="25" />
                        </TableCell>
                        <TableCell>{server.name}</TableCell>
                        <TableCell>
                          <IconButton
                            component={RouterLink}
                            to={`/settings/plex`}
                            color="primary"
                          >
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
          {!isPlexConnected ? (
            <CardActions sx={{ justifyContent: 'center' }}>
              <AddPlexServer title={title} />
            </CardActions>
          ) : null}
        </CardContent>
      </Card>
    </Box>
  );
}
