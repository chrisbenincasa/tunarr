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

type AddRestrictHoursModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddRestrictHoursModal = ({
  open,
  onClose,
}: AddRestrictHoursModalProps) => {
  const restrictHoursProgramming = () => {
    console.log('To do');
  };
  const hours = [...Array(24).keys()]; // Generate array of hours (0-23)

  return (
    <Dialog open={open}>
      <DialogTitle>Restrict Hours</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The channel's regular programming between the specified hours. Flex
          time will fill up the remaining hours.
        </DialogContentText>
        <Box sx={{ display: 'flex', my: 1 }}>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="restrict-hours-start-label">Start</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="restrict-hours-start-label"
              id="restrict-hours-start"
            >
              {hours.map((hour) => (
                <MenuItem key={hour} value={hour}>
                  {hour < 10 ? `0${hour}:00` : `${hour}:00`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="restrict-hours-end-label">End</InputLabel>
            <Select
              value={'fixed'}
              label={'Type'}
              labelId="restrict-hours-end-label"
              id="restrict-hours-end"
            >
              {hours.map((hour) => (
                <MenuItem key={hour} value={hour}>
                  {hour < 10 ? `0${hour}:00` : `${hour}:00`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => restrictHoursProgramming()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRestrictHoursModal;
