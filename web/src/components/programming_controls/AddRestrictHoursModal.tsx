import {
  DialogContentText,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { isNumber, range } from 'lodash-es';
import { useState } from 'react';
import { useRestrictHours } from '../../hooks/programming_controls/useRestrictHours.ts';

type AddRestrictHoursModalProps = {
  open: boolean;
  onClose: () => void;
};

// TODO:
// Replace with time pickers
// use react hook form
const AddRestrictHoursModal = ({
  open,
  onClose,
}: AddRestrictHoursModalProps) => {
  const [startHour, setStartHour] = useState<number>(0);
  const [endHour, setEndHour] = useState<number>(4);

  const restrictHours = useRestrictHours();

  const handleClick = () => {
    restrictHours(startHour, endHour);
    onClose();
  };

  return (
    <Dialog open={open}>
      <DialogTitle>Restrict Hours</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The channel's regular programming between the specified hours. Flex
          time will fill up the remaining hours.
        </DialogContentText>
        <Stack sx={{ display: 'flex', my: 1 }}>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="restrict-hours-start-label">Start</InputLabel>
            <Select
              value={startHour}
              label={'Start'}
              labelId="restrict-hours-start-label"
              id="restrict-hours-start"
              onChange={(e) =>
                setStartHour(
                  isNumber(e.target.value)
                    ? e.target.value
                    : parseInt(e.target.value.split(':')[0]),
                )
              }
            >
              {range(0, 24).map((hour) => (
                <MenuItem key={hour} value={hour}>{`${hour}:00`}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl sx={{ my: 1, flexGrow: 1 }}>
            <InputLabel id="restrict-hours-end-label">End</InputLabel>
            <Select
              value={endHour}
              label={'Type'}
              labelId="restrict-hours-end-label"
              id="restrict-hours-end"
              onChange={(e) =>
                setEndHour(
                  isNumber(e.target.value)
                    ? e.target.value
                    : parseInt(e.target.value.split(':')[0]),
                )
              }
            >
              {range(0, 24).map((hour) => (
                <MenuItem key={hour} value={hour}>{`${hour}:00`}</MenuItem>
              ))}
            </Select>
            {startHour >= endHour && (
              <FormHelperText error>Start must be before End</FormHelperText>
            )}
          </FormControl>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => handleClick()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRestrictHoursModal;
