import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { TextField } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useCallback, useEffect, useState } from 'react';
import {
  addProgramsToCurrentChannel,
  setProgramAtIndex,
} from '../../store/channelEditor/actions.ts';
import { isUndefined, omit } from 'lodash-es';
import type { UIFlexProgram } from '../../types/index.ts';

dayjs.extend(duration);

type AddRedirectModalProps = {
  open: boolean;
  onClose: () => void;
  // A little hacky but we need to know where to update
  initialProgram?: UIFlexProgram & { index: number };
};

// 5 mins
const DefaultDurationSeconds = 5 * 60;

const AddFlexModal = ({
  open,
  onClose,
  initialProgram,
}: AddRedirectModalProps) => {
  const [duration, setDuration] = useState(
    (initialProgram?.duration
      ? initialProgram.duration / 1000
      : DefaultDurationSeconds
    ).toFixed(),
  );
  const parsedDuration = parseInt(duration);

  useEffect(() => {
    if (initialProgram) {
      setDuration((initialProgram.duration / 1000).toFixed());
    }
  }, [initialProgram]);

  const setDurationValidated = useCallback(
    (value: string) => {
      const parsed = parseInt(value);
      if (value.length === 0) {
        setDuration('');
        return;
      }
      if (!isNaN(parsed)) {
        setDuration(parsed.toString());
      }
    },
    [setDuration],
  );

  const isNotNumeric = isNaN(parsedDuration);
  const isGreaterThanZero = parsedDuration > 0;
  const isInvalid = isNotNumeric || !isGreaterThanZero;

  const addFlex = useCallback(() => {
    if (!isInvalid) {
      if (!isUndefined(initialProgram)) {
        setProgramAtIndex(
          {
            ...omit(initialProgram, 'index'),
            duration: parsedDuration * 1000,
            persisted: false,
          },
          initialProgram.index,
        );
      } else {
        addProgramsToCurrentChannel([
          { type: 'flex', duration: parsedDuration * 1000, persisted: false },
        ]);
      }
      onClose();
    }
  }, [isInvalid, initialProgram, onClose, parsedDuration]);

  return (
    <Dialog open={open}>
      <DialogTitle>
        {!isUndefined(initialProgram) ? 'Edit' : 'Add'} Flex Time
      </DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          margin="normal"
          label="Duration (seconds)"
          value={duration}
          error={isInvalid}
          onChange={(e) => setDurationValidated(e.target.value)}
          helperText={
            isNotNumeric
              ? 'Duration must be numeric'
              : !isGreaterThanZero
                ? 'Duration must be greater than 0.'
                : dayjs.duration(parsedDuration, 'seconds').humanize()
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button variant="contained" onClick={() => addFlex()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddFlexModal;
