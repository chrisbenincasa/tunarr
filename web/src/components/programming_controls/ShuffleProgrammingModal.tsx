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
import { Trans, useLingui } from '@lingui/react/macro';

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
  const { t } = useLingui();
  const shuffler = useProgramShuffle();

  const handleShuffle = () => {
    shuffler(shuffleType);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle><Trans>Shuffle Programming</Trans></DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <FormControl sx={{ width: '100%' }}>
            <InputLabel><Trans>Shuffle Grouping</Trans></InputLabel>
            <Select
              label={t`Shuffle Grouping`}
              value={shuffleType}
              onChange={(v) =>
                onShuffleTypeChange(v.target.value as ShuffleGroupingValue)
              }
            >
              <MenuItem value={'none'}><Trans>None</Trans></MenuItem>
              <MenuItem value={'show'}><Trans>Show</Trans></MenuItem>
            </Select>
            <FormHelperText>
              <Trans>Shuffle programming in a channel, optionally grouping programs by
              certain criteria.</Trans>
              <br />
              <ul>
                <li>
                  <strong><Trans>None:</Trans></strong>{' '}<Trans>Do not group programs at all. Normal
                  shuffle.</Trans>
                </li>
                <li>
                  <strong><Trans>Show:</Trans></strong>{' '}<Trans>Group episode programs by their show.</Trans>
                </li>
              </ul>
            </FormHelperText>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}><Trans>Cancel</Trans></Button>
        <Button
          onClick={() => handleShuffle()}
          startIcon={<Shuffle />}
          variant="contained"
        >
          <Trans>Shuffle</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};
