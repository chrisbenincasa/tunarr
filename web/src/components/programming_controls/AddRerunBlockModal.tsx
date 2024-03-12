import {
  DialogContentText,
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

type AddRerunModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddRerunBlockModal = ({ open, onClose }: AddRerunModalProps) => {
  const rerunBlockProgramming = () => {
    console.log('To do');
  };
  const hours = [...Array(24).keys()]; // Generate array of hours (0-23)
  const blocks = [4, 6, 8, 12];
  const repeats = [2, 3, 4, 6];

  return (
    <Dialog open={open}>
      <DialogTitle>Create Rerun Block</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Divides the programming in blocks of 4, 6, 8 or 12 hours then repeats
          each of the blocks the specified number of times.
        </DialogContentText>
        <FormGroup>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="rerun-hours-start-label">Start</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="rerun-hours-start-label"
              id="rerun-hours-start"
              fullWidth
            >
              {hours.map((hour) => (
                <MenuItem key={hour} value={hour}>
                  {hour < 10 ? `0${hour}:00` : `${hour}:00`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="rerun-block-label">Block</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="rerun-block-label"
              id="rerun-block"
            >
              {blocks.map((block) => (
                <MenuItem key={block} value={block}>
                  {`${block} Hours`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ my: 1, display: 'flex', flexGrow: 1 }}>
            <InputLabel id="rerun-repeats-label">Repeats</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="rerun-repeats-label"
              id="rerun-repeats"
            >
              {repeats.map((repeat) => (
                <MenuItem key={repeat} value={repeat}>
                  {repeat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => rerunBlockProgramming()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRerunBlockModal;
