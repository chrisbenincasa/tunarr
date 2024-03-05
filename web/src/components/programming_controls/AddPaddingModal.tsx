import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  FormControl,
  DialogTitle,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  DialogContentText,
} from '@mui/material';
import { Expand as PaddingIcon } from '@mui/icons-material';
import {
  StartTimePadding,
  StartTimePaddingOptions,
  usePadStartTimes,
} from '../../hooks/programming_controls/usePadStartTimes.ts';

type AddPaddingModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddPaddingModal = ({ open, onClose }: AddPaddingModalProps) => {
  const [currentPadding, setCurrentPadding] = useState<StartTimePadding | null>(
    null,
  );
  const padStartTimes = usePadStartTimes();

  return (
    <Dialog open={open}>
      <DialogTitle>Pad Start Times</DialogTitle>
      <DialogContent sx={{ py: 0 }}>
        <DialogContentText>
          Adds Flex breaks after each TV episode or movie to ensure that the
          program starts at one of the allowed minute marks.
        </DialogContentText>
        <FormGroup sx={{ flexGrow: 1, flexWrap: 'nowrap' }}>
          <FormControl fullWidth sx={{ my: 1 }}>
            <InputLabel>Pad Start Times</InputLabel>
            <Select
              value={currentPadding?.mod ?? -1}
              label={'Pad Start Times'}
              onChange={(e) =>
                setCurrentPadding(
                  e.target.value === -1
                    ? null
                    : StartTimePaddingOptions.find(
                        (opt) => opt.mod === e.target.value,
                      )!,
                )
              }
            >
              {StartTimePaddingOptions.map((opt, idx) => (
                <MenuItem key={idx} value={opt.mod}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          onClick={() => {
            padStartTimes(currentPadding);
            onClose();
          }}
          startIcon={<PaddingIcon />}
          variant="contained"
        >
          Add Padding
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPaddingModal;
