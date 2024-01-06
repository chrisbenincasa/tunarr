import Dialog from '@mui/material/Dialog';
import { useChannelAndLineup } from '../hooks/useChannelLineup.ts';
import DialogTitle from '@mui/material/DialogTitle';
import Skeleton from '@mui/material/Skeleton';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import { ChannelProgrammingConfig } from './channel_config/ChannelProgrammingConfig.tsx';
import { useEffect } from 'react';
import { setCurrentChannel } from '../store/channelEditor/actions.ts';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

interface EditChannelProgrammingModalProps {
  open: boolean;
  onClose: () => void;
  channelNumber: number;
}

export default function EditChannelProgrammingModal(
  props: EditChannelProgrammingModalProps,
) {
  const {
    isPending,
    data: { channel, lineup: channelLineup },
  } = useChannelAndLineup(props.channelNumber);

  console.log(channel, channelLineup);

  useEffect(() => {
    if (channel && channelLineup) {
      setCurrentChannel(channel, channelLineup.programs);
    }
  }, [channel, channelLineup]);

  const onSave = () => {
    console.log('Save');
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      maxWidth="md"
      fullWidth
      keepMounted={false}
    >
      <DialogTitle>Edit Channel Programming</DialogTitle>
      {isPending ? (
        <Skeleton>
          <DialogContent />
        </Skeleton>
      ) : (
        <DialogContent>
          <Box sx={{ borderColor: 'background.paper', borderBottom: 1 }}>
            <ChannelProgrammingConfig />
          </Box>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button onClick={() => onSave()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}
