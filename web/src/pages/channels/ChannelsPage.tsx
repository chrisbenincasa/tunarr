import { Delete, PlayArrow as WatchIcon } from '@mui/icons-material';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import EditIcon from '@mui/icons-material/Edit';
import SettingsRemoteIcon from '@mui/icons-material/SettingsRemote';
import TextSnippetIcon from '@mui/icons-material/TextSnippet';
import {
  Box,
  Button,
  CircularProgress,
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
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash-es';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import TunarrLogo from '../../components/TunarrLogo.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { apiClient } from '../../external/api.ts';
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteChannelConfirmation, setDeleteChannelConfirmation] = useState<
    string | undefined
  >(undefined);

  const handleChannelNavigation = (
    _: React.MouseEvent<HTMLTableRowElement, MouseEvent>,
    id: string,
  ) => {
    navigate(`/channels/${id}/programming`);
  };

  const removeChannelMutation = useMutation({
    mutationFn: (id: string) => {
      return apiClient.deleteChannel(undefined, { params: { id } });
    },
    onSuccess: () => {
      return queryClient.invalidateQueries({
        queryKey: ['channels'],
      });
    },
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
        <TableCell>{channel.number}</TableCell>
        {!smallViewport && (
          <TableCell>
            {isEmpty(channel.icon.path) ? (
              <TunarrLogo style={{ width: '40px' }} />
            ) : (
              <img style={{ maxHeight: '40px' }} src={channel.icon.path} />
            )}
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
              <WatchIcon />
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
          <TableCell
            colSpan={smallViewport ? 5 : 6}
            sx={{ my: 2, textAlign: 'center' }}
          >
            <CircularProgress />
          </TableCell>
        </TableRow>
      );
    } else if (channelsError) {
      return (
        <TableRow key="error">
          <TableCell
            colSpan={smallViewport ? 5 : 6}
            sx={{ my: 2, textAlign: 'center' }}
          >{`Error: ${channelsError.message}`}</TableCell>
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
        <Button
          component={RouterLink}
          to="/channels/new"
          variant="contained"
          startIcon={<AddCircleIcon />}
        >
          New
        </Button>
      </Box>

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
          <TableBody>
            {channels && channels.length > 0 && getTableRows()}
          </TableBody>
        </Table>
      </TableContainer>

      {channels && channels.length === 0 && (
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
