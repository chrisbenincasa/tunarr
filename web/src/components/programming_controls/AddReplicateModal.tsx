import { MenuItem, Select, TextField } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

type AddReplicateModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddReplicateModal = ({ open, onClose }: AddReplicateModalProps) => {
  const replicateProgramming = () => {
    console.log('To do');
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Replicate</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          margin="normal"
          label="Repeats"
          // value={duration}
          // onChange={(e) => setDurationValidated(e.target.value)}
          // helperText={
          //   isNotNumeric
          //     ? 'Duration must be numeric'
          //     : !isGreaterThanZero
          //     ? 'Duration must be greater than 0.'
          //     : ' '
          // }
        />
        <Select
          value={'fixed'}
          label={'Type'}
          // sx={{ flexGrow: 1 }}
          // onChange={(e) =>
          //   setCurrentPadding(
          //     e.target.value === -1
          //       ? null
          //       : StartTimePaddingOptions.find(
          //           (opt) => opt.mod === e.target.value,
          //         )!,
          //   )
          // }
        >
          <MenuItem key={'fixed'} value={'fixed'}>
            Fixed
          </MenuItem>
          <MenuItem key={'random'} value={'random'}>
            Shuffle
          </MenuItem>
        </Select>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => replicateProgramming()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddReplicateModal;
