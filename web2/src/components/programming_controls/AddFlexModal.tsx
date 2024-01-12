import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import { useChannels } from '../../hooks/useChannels.ts';
import {
  CircularProgress,
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import useStore from '../../store/index.ts';

type AddRedirectModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddRedirectModal = (props: AddRedirectModalProps) => {
  const currentChannel = useStore((s) => s.channelEditor.currentChannel);
  const { isPending, error, data } = useChannels();

  const dialogContent = () => {
    if (isPending) {
      return <CircularProgress />;
    } else if (data) {
      return (
        <FormGroup>
          <FormControl fullWidth margin="normal">
            <InputLabel>Channel</InputLabel>
            <Select label="Channel">
              {data
                .filter((channel) => channel.number !== currentChannel?.number)
                .map((channel) => (
                  <MenuItem key={channel.number}>{channel.name}</MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField fullWidth margin="normal" label="Duration (seconds)" />
        </FormGroup>
      );
    } else {
      return (
        <Typography>
          Error occurred while loading channels, please try again soon.{' '}
          {error ? error.message : null}
        </Typography>
      );
    }
  };

  return (
    <Dialog open={props.open}>
      <DialogTitle>Add Channel Redirect</DialogTitle>
      <DialogContent>{dialogContent()}</DialogContent>
      <DialogActions>
        <Button onClick={() => props.onClose()}>Cancel</Button>
        <Button>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRedirectModal;
