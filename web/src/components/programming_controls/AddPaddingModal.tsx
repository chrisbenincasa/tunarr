import { Expand as PaddingIcon } from '@mui/icons-material';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { find } from 'lodash-es';
import { useCallback, useState } from 'react';
import { handleNumericFormValue } from '../../helpers/util.ts';
import type { StartTimePadding } from '../../hooks/programming_controls/usePadStartTimes.ts';
import {
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

  const handlePaddingChange = useCallback(
    (value: number) => {
      setCurrentPadding(
        value === -1 || isNaN(value)
          ? null
          : find(StartTimePaddingOptions, { key: value })!,
      );
    },
    [setCurrentPadding],
  );

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
            <Select<StartTimePadding['key']>
              value={currentPadding?.key ?? -1}
              label={'Pad Start Times'}
              onChange={(e) =>
                handlePaddingChange(
                  handleNumericFormValue(e.target.value, true),
                )
              }
            >
              {StartTimePaddingOptions.map((opt, idx) => (
                <MenuItem key={idx} value={opt.key}>
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
