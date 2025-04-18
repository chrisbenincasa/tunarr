import { DialogContentText, Stack, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { TimePicker } from '@mui/x-date-pickers';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useCallback, useMemo, useState } from 'react';
import { OneDayMillis } from '../../helpers/constants.ts';
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
  const [startOffset, setStartOffset] = useState(0);
  const [endOffset, setEndOffset] = useState(
    dayjs.duration({ hours: 4 }).asMilliseconds(),
  );

  const restrictHours = useRestrictHours();

  const handleClick = () => {
    restrictHours(startOffset, endOffset);
    onClose();
  };

  const start = useMemo(
    () => dayjs().startOf('day').add(startOffset),
    [startOffset],
  );
  const end = useMemo(() => dayjs().startOf('day').add(endOffset), [endOffset]);

  const handleStartOffset = useCallback(
    (value: Dayjs | null) => {
      if (!value) {
        return;
      }

      const offset = value.mod({ days: 1 }, true).asMilliseconds();

      if (offset > endOffset) {
        setEndOffset((prev) => prev + OneDayMillis);
      }

      setStartOffset(offset);
    },
    [endOffset],
  );

  const handleToOffset = useCallback(
    (value: Dayjs | null) => {
      if (!value) {
        return;
      }

      let offset = value.mod({ days: 1 }, true).asMilliseconds();

      if (offset < startOffset) {
        offset += OneDayMillis;
      }

      // if (offset === 0) {
      //   offset = OneDayMillis;
      // }

      setEndOffset(offset);
    },
    [startOffset],
  );

  const scheduleText = useMemo(() => {
    let text = `Programming starts at ${start.format('LT')} and stops at ${end.format('LT')}`;
    if (endOffset >= OneDayMillis) {
      return (text += ' the following day.');
    }
  }, [end, endOffset, start]);

  return (
    <Dialog open={open}>
      <DialogTitle>Restrict Hours</DialogTitle>
      <DialogContent>
        <DialogContentText>
          The channel's regular programming between the specified hours. Flex
          time will fill up the remaining hours.
        </DialogContentText>
        <Stack
          direction="row"
          sx={{ mt: 3, mb: 2 }}
          gap={2}
          alignItems="center"
        >
          <TimePicker
            sx={{ flex: 1 }}
            value={start}
            onChange={handleStartOffset}
            label="Start Time"
            closeOnSelect={false}
            slotProps={{
              textField: {
                error: start.isAfter(end),
              },
            }}
          />
          <Typography>TO</Typography>
          <TimePicker
            sx={{ flex: 1 }}
            value={end}
            maxTime={start.add(1, 'day')}
            onChange={handleToOffset}
            label="End Time"
            closeOnSelect={false}
            slotProps={{
              textField: {
                error: end.isBefore(start),
              },
            }}
          />
        </Stack>
        <DialogContentText variant="caption">{scheduleText}</DialogContentText>
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
