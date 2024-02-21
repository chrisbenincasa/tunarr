import AddCircleIcon from '@mui/icons-material/AddCircle';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import EditIcon from '@mui/icons-material/Edit';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash-es';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { useChannels } from '../../hooks/useChannels.ts';
import { Delete, Tv } from '@mui/icons-material';
import { useState } from 'react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { apiClient } from '../../external/api.ts';

export default function ChannelsPage() {
  const now = dayjs();
  const {
    isPending: channelsLoading,
    error: channelsError,
    data: channels,
  } = useChannels();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState<
    string | undefined
  >(undefined);

  const handleChannelNavigation = (
    event: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    id: string,
  ) => {
    navigate(`/channels/${id}/programming`);
  };

  const removeChannelMutation = useMutation({
    // To do: Update the below when the channel delete endpoint exists
    // mutationFn: (id: string) => {
    //   return apiClient.deleteChannel(null, { params: { id } });
    // },
    // onSuccess: () => {
    //   return queryClient.invalidateQueries({
    //     queryKey: ['settings', 'plex-servers'],
    //   });
    // },
  });

  const removeChannel = (id: string) => {
    removeChannelMutation.mutate(id);
    setDeleteChannelConfirmation(undefined);
  };

  const renderConfirmationDialog = () => {
    return (
      <Dialog
        open={!!deleteChannelConfirmation}
        onClose={() => setDeleteChannelConfirmation(undefined)}
        aria-labelledby="delete-channel-title"
        aria-describedby="delete-channel-description"
      >
        <DialogTitle id="delete-channel-title">{'Delete Channel?'}</DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-channel-description">
            Deleting a Channel will remove all programming from the channel.
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDeleteChannelConfirmation(undefined)}
            autoFocus
          >
            Cancel
          </Button>
          <Button
            onClick={() => removeChannel(deleteChannelConfirmation!)}
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  if (channelsLoading) return 'Loading...';

  if (channelsError) return 'An error occurred!: ' + channelsError.message;

  // TODO properly define types from API
  const getDataTableRow = (channel: Channel) => {
    const startTime = dayjs(channel.startTime);
    return (
      <TableRow
        key={channel.number}
        onClick={(event) => handleChannelNavigation(event, channel.id)}
        sx={{ cursor: 'pointer' }}
        hover={true}
      >
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
        <TableCell sx={{ textAlign: 'right' }}>
          <Tooltip title="Get Channel M3U File" placement="top">
            <IconButton
              href={`//localhost:8000/media-player/${channel.number}.m3u`}
              color={'primary'}
              onClick={(e) => e.stopPropagation()}
            >
              <TextSnippetIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Watch Channel" placement="top">
            <IconButton
              component={RouterLink}
              to={`/channels/${channel.id}/watch`}
              color="primary"
              onClick={(e) => e.stopPropagation()}
            >
              <Tv />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Channel Settings" placement="top">
            <IconButton
              to={`/channels/${channel.id}/edit`}
              component={RouterLink}
              color={'primary'}
              onClick={(e) => e.stopPropagation()}
            >
              <EditIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Channel" placement="top">
            <IconButton
              color={'primary'}
              onClick={(e) => {
                e.stopPropagation();
                setDeleteChannelConfirmation(channel.id);
              }}
            >
              <Delete />
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
        {renderConfirmationDialog()}
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
