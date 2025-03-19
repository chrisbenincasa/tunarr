import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import type { Channel } from '@tunarr/types';
import type { Nullable } from '../../types/util.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  channel: Nullable<Channel>;
};

export const ChannelSessionsDialog = ({ open, onClose, channel }: Props) => {
  if (!channel) {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>"{channel.name}" Sessions</DialogTitle>
      <DialogContent>
        <pre>{JSON.stringify(channel.sessions, undefined, 2)}</pre>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Close</Button>
      </DialogActions>
    </Dialog>
  );
};
