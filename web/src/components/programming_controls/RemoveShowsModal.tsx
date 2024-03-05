import { Box, DialogContentText } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

type RemoveShowsModalProps = {
  open: boolean;
  onClose: () => void;
};

const RemoveShowsModal = ({ open, onClose }: RemoveShowsModalProps) => {
  const removeShowsProgramming = () => {
    console.log('To do');
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Remove Shows</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Pick specific shows to remove from the channel.
        </DialogContentText>
        <Box sx={{ display: 'flex', my: 1 }}>{/* To do */}</Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => removeShowsProgramming()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemoveShowsModal;
