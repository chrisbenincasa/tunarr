import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { Channel } from 'dizquetv-types';
import { Link as RouterLink } from 'react-router-dom';
import { useChannels } from '../../hooks/useChannels.ts';

export default function ChannelsPage() {
  const {
    isPending: channelsLoading,
    error: channelsError,
    data: channels,
  } = useChannels();

  if (channelsLoading) return 'Loading...';

  if (channelsError) return 'An error occurred!: ' + channelsError.message;

  // TODO properly define types from API
  const getDataTableRow = (channel: Channel) => {
    return (
      <TableRow key={channel.number}>
        <TableCell width="10%">{channel.number}</TableCell>
        <TableCell width="10%">
          <img style={{ maxHeight: '40px' }} src={channel.icon.path} />
        </TableCell>
        <TableCell>{channel.name}</TableCell>
        <TableCell width="15%">
          <Tooltip title="Edit" placement="top">
            <IconButton
              color="primary"
              to={`/channels/${channel.number}/edit`}
              component={RouterLink}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Programs" placement="top">
            <IconButton
              to={`/channels/${channel.number}/programming`}
              component={RouterLink}
            >
              <SettingsRemoteIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
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
        <Button variant="contained" startIcon={<AddCircleIcon />}>
          New
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Number</TableCell>
              <TableCell>Icon</TableCell>
              <TableCell>Name</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{getTableRows()}</TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}
