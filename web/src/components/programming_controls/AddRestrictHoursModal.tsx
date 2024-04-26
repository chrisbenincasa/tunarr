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
import { range } from 'lodash-es';
import { useState } from 'react';
import { useRestrictHours } from '../../hooks/programming_controls/useRestrictHours.ts';

type AddRestrictHoursModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddRestrictHoursModal = ({
  open,
  onClose,
}: AddRestrictHoursModalProps) => {
  const [startHour, setStartHour] = useState<string | null>(null);
  const [endHour, setEndHour] = useState<string | null>(null);

  const restrictHours = useRestrictHours();

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
              onChange={(e) => setStartHour(e.target.value)}
            >
              {range(0, 24).map((hour) => (
                <MenuItem key={hour}>{`${hour}:00`}</MenuItem>
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
              onChange={(e) => setEndHour(e.target.value)}
            >
              {range(0, 24).map((hour) => (
                <MenuItem key={hour}>{`${hour}:00`}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => restrictHours(Number(startHour), Number(endHour))}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRestrictHoursModal;
