import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash-es';
import { Link as RouterLink } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { useChannels } from '../../hooks/useChannels.ts';

export default function ChannelsPage() {
  const now = dayjs();
  const {
    isPending: channelsLoading,
    error: channelsError,
    data: channels,
  } = useChannels();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  if (channelsLoading) return 'Loading...';

  if (channelsError) return 'An error occurred!: ' + channelsError.message;

  // TODO properly define types from API
  const getDataTableRow = (channel: Channel) => {
    const startTime = dayjs(channel.startTime);
    return (
      <TableRow key={channel.number}>
        <TableCell width="10%">{channel.number}</TableCell>
        {!smallViewport && (
          <TableCell width="10%">
            <img
              style={{ maxHeight: '40px' }}
              src={
                isEmpty(channel.icon.path) ? '/dizquetv.png' : channel.icon.path
              }
            />
          </TableCell>
        )}
        <TableCell>{channel.name}</TableCell>
        <TableCell>{startTime.isBefore(now) ? 'Yes' : 'No'}</TableCell>
        <TableCell>{channel.stealth ? 'Yes' : 'No'}</TableCell>
        <TableCell width={smallViewport ? '15%' : undefined}>
          <Stack direction={'row'} justifyContent={'flex-end'}>
            <Tooltip title="Edit Channel Settings" placement="top">
              {smallViewport ? (
                <IconButton
                  to={`/channels/${channel.id}/edit`}
                  component={RouterLink}
                  color={'primary'}
                >
                  <EditIcon />
                </IconButton>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  to={`/channels/${channel.id}/edit`}
                  component={RouterLink}
                  sx={{ marginRight: 1 }}
                  color={'primary'}
                >
                  Edit
                </Button>
              )}
            </Tooltip>
            <Tooltip title="Add/Edit Programming" placement="top">
              {smallViewport ? (
                <IconButton
                  to={`/channels/${channel.id}/programming`}
                  component={RouterLink}
                  color={'primary'}
                >
                  <SettingsRemoteIcon />
                </IconButton>
              ) : (
                <Button
                  variant="contained"
                  startIcon={<SettingsRemoteIcon />}
                  to={`/channels/${channel.id}/programming`}
                  component={RouterLink}
                  color={'primary'}
                >
                  Add Programs
                </Button>
              )}
            </Tooltip>
          </Stack>
        </TableCell>
      </TableRow>
    );
  };

  const getTableRows = () => {
    if (channelsLoading) {
      return (
        <TableRow key="pending">
          <TableCell colSpan={4}>Loading....</TableCell>
        </TableRow>
      );
    } else if (channelsError) {
      return (
        <TableRow key="pending">
          <TableCell colSpan={4}>Error</TableCell>
        </TableRow>
      );
    } else {
      return channels?.map(getDataTableRow);
    }
  };

  return (
    <div>
      <Box display="flex" mb={2}>
        <Typography flexGrow={1} variant="h4">
          Channels
        </Typography>
        {channels.length ? (
          <Button
            component={RouterLink}
            to="/channels/new"
            variant="contained"
            startIcon={<AddCircleIcon />}
          >
            New
          </Button>
        ) : null}
      </Box>
      {channels.length > 0 ? (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Number</TableCell>
                {!smallViewport && <TableCell>Icon</TableCell>}
                <TableCell>Name</TableCell>
                <TableCell>Live?</TableCell>
                <TableCell>Stealth?</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{getTableRows()}</TableBody>
          </Table>
        </TableContainer>
      ) : (
        <PaddedPaper
          sx={{
            display: 'flex',
            justifyContent: 'center',
            py: 10,
            textAlign: 'center',
          }}
        >
          <Box>
            <SettingsRemoteIcon fontSize="large" />
            <Typography variant="h5">
              You haven't created any channels yet.
            </Typography>
            <Button
              variant="contained"
              sx={{
                my: 2,
                maxWidth: 350,
                textAlign: 'center',
              }}
              component={RouterLink}
              to="/channels/new"
            >
              Create your First Channel Now!
            </Button>
          </Box>
        </PaddedPaper>
      )}
    </div>
  );
}
