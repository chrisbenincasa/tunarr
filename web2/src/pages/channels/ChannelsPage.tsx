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
import { isUndefined, maxBy } from 'lodash-es';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import EditChannelSettingsModal from '../../components/EditChannelModal.tsx';
import EditChannelProgrammingModal from '../../components/EditChannelProgrammingModal.tsx';
import { useChannels } from '../../hooks/useChannels.ts';
import { resetChannelEditorState } from '../../store/channelEditor/actions.ts';

export default function ChannelsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [programmingModalOpen, setProgrammingModalOpen] = useState(false);
  const [channelModalConfig, setChannelModalConfig] = useState<
    { channelNumber: number; isNew: boolean } | undefined
  >(undefined);
  const {
    isPending: channelsLoading,
    error: channelsError,
    data: channels,
  } = useChannels();

  if (channelsLoading) return 'Loading...';

  if (channelsError) return 'An error occurred!: ' + channelsError.message;

  const openModal = (channelNumber?: number) => {
    resetChannelEditorState();
    setChannelModalConfig({
      channelNumber:
        channelNumber ??
        (channels.length === 0 ? 1 : maxBy(channels, 'number')!.number + 1),
      isNew: isUndefined(channelNumber),
    });
    setCreateModalOpen(true);
  };

  const openProgrammingModal = (channelNumber: number) => {
    resetChannelEditorState();
    setChannelModalConfig({ channelNumber, isNew: false });
    setProgrammingModalOpen(true);
  };

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
        <Button
          onClick={() => openModal()}
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
              <TableCell>Icon</TableCell>
              <TableCell>Name</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{getTableRows()}</TableBody>
        </Table>
      </TableContainer>
      {/* <EditChannelSettingsModal
        channelNumber={channelModalConfig?.channelNumber ?? -1}
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        isNew={channelModalConfig?.isNew ?? true}
      />
      <EditChannelProgrammingModal
        channelNumber={channelModalConfig?.channelNumber ?? -1}
        open={programmingModalOpen}
        onClose={() => setProgrammingModalOpen(false)}
      /> */}
    </div>
  );
}
