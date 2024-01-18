import { TextField } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import { useCallback, useState } from 'react';
import { addProgramsToCurrentChannel } from '../../store/channelEditor/actions.ts';

type AddRedirectModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddRedirectModal = ({ open, onClose }: AddRedirectModalProps) => {
  const [duration, setDuration] = useState(60 * 60 + '');
  const parsedDuration = parseInt(duration);

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
      addProgramsToCurrentChannel([
        { type: 'flex', duration: parsedDuration * 1000, persisted: false },
      ]);
      onClose();
    }
  }, [isInvalid, parsedDuration, onClose]);

  return (
    <Dialog open={open}>
      <DialogTitle>Add Flex (offline time)</DialogTitle>
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
              : ' '
          }
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button onClick={() => addFlex()}>Save</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddRedirectModal;
