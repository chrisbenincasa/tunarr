import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from '@mui/icons-material/Delete';
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
  Typography,
} from '@mui/material';
import { Channel } from 'dizquetv-types';
import { useState } from 'react';
import CreateChannelModal from '../../components/EditChannelModal.tsx';
import { useChannels } from '../../hooks/useChannels.ts';
import { isUndefined, maxBy } from 'lodash-es';

export default function ChannelsPage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
    setChannelModalConfig({
      channelNumber:
        channelNumber ??
        (channels.length === 0 ? 1 : maxBy(channels, 'number')!.number + 1),
      isNew: isUndefined(channelNumber),
    });
    setCreateModalOpen(true);
  };

  // TODO properly define types from API
  const getDataTableRow = (channel: Channel) => {
    return (
      <TableRow
        sx={{ cursor: 'pointer' }}
        onClick={() => openModal(channel.number)}
        key={channel.number}
      >
        <TableCell width="10%">{channel.number}</TableCell>
        <TableCell width="10%">
          <img style={{ maxHeight: '40px' }} src={channel.icon.path} />
        </TableCell>
        <TableCell>{channel.name}</TableCell>
        <TableCell width="10%">
          <IconButton color="error">
            <DeleteIcon />
          </IconButton>
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
      <CreateChannelModal
        channelNumber={channelModalConfig?.channelNumber ?? -1}
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        isNew={channelModalConfig?.isNew ?? true}
      />
    </div>
  );
}
