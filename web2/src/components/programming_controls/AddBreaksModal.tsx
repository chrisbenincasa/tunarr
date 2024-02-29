import {
  Box,
  DialogContentText,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

type AddBreaksModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddBreaksModal = ({ open, onClose }: AddBreaksModalProps) => {
  const breaksProgramming = () => {
    console.log('To do');
  };
  const after = [5, 10, 15, 20, 25, 30, 60, 90, 120];
  const minDuration = [
    10, 15, 30, 45, 60, 90, 120, 180, 300, 450, 600, 1200, 1800,
  ];
  const maxDuration = [
    10, 15, 30, 45, 60, 90, 120, 180, 300, 450, 600, 1200, 1800,
  ];
  return (
    <Dialog open={open}>
      <DialogTitle>Add Breaks</DialogTitle>
      <DialogContent>
        <DialogContentText>
          Adds Flex breaks between programs, attempting to avoid groups of
          consecutive programs that exceed the specified number of minutes.
        </DialogContentText>
        <Box sx={{ display: 'flex', my: 1 }}>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="rerun-hours-start-label">After</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="rerun-hours-start-label"
              id="rerun-hours-start"
            >
              {after.map((minute) => (
                <MenuItem key={minute} value={minute}>
                  {`${minute} Minutes`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="rerun-block-label">Min Duration</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="rerun-block-label"
              id="rerun-block"
            >
              {minDuration.map((duration) => (
                <MenuItem key={duration} value={duration}>
                  {`${duration} Seconds`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ my: 1, display: 'flex', flexGrow: 1 }}>
            <InputLabel id="rerun-repeats-label">Max Duration</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="rerun-repeats-label"
              id="rerun-repeats"
            >
              {maxDuration.map((duration) => (
                <MenuItem key={duration} value={duration}>
                  {`${duration} Seconds`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => breaksProgramming()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddBreaksModal;
