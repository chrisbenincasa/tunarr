import { TextField } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

type AddRedirectModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddRedirectModal = (props: AddRedirectModalProps) => {
  return (
    <Dialog open={props.open}>
      <DialogTitle>Add Channel Redirect</DialogTitle>
      <DialogContent>
        <TextField fullWidth margin="normal" label="Duration (seconds)" />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>Cancel</Button>
        <Button>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRedirectModal;
