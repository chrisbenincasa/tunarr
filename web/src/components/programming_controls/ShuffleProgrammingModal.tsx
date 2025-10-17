import { Shuffle } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { useProgramShuffle } from '../../hooks/programming_controls/useRandomSort.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  onShuffleTypeChange: (change: ShuffleGroupingValue) => void;
  shuffleType: ShuffleGroupingValue;
};

export type ShuffleGroupingValue = 'none' | 'show';

export const ShuffleProgrammingModal = ({
  open,
  onClose,
  onShuffleTypeChange,
  shuffleType,
}: Props) => {
  const shuffler = useProgramShuffle();

  const handleShuffle = () => {
    shuffler(shuffleType);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Shuffle Programming</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <FormControl sx={{ width: '100%' }}>
            <InputLabel>Shuffle Grouping</InputLabel>
            <Select
              label="Shuffle Grouping"
              value={shuffleType}
              onChange={(v) =>
                onShuffleTypeChange(v.target.value as ShuffleGroupingValue)
              }
            >
              <MenuItem value={'none'}>None</MenuItem>
              <MenuItem value={'show'}>Show</MenuItem>
            </Select>
            <FormHelperText>
              Shuffle programming in a channel, optionally grouping programs by
              certain criteria.
              <br />
              <ul>
                <li>
                  <strong>None:</strong> Do not group programs at all. Normal
                  shuffle.
                </li>
                <li>
                  <strong>Show:</strong> Group episode programs by their show.
                </li>
              </ul>
            </FormHelperText>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button
          onClick={() => handleShuffle()}
          startIcon={<Shuffle />}
          variant="contained"
        >
          Shuffle
        </Button>
      </DialogActions>
    </Dialog>
  );
};
