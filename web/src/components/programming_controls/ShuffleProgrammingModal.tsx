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

const ShuffleProgrammingModalContent = ({
  onClose,
  onShuffleTypeChange,
  shuffleType,
}: Omit<Props, 'open'>) => {
  const { t } = useLingui();
  const shuffler = useProgramShuffle();

  const handleShuffle = () => {
    shuffler(shuffleType);
    onClose();
  };

  return (
    <>
      <DialogTitle>
        <Trans>Shuffle Programming</Trans>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <FormControl sx={{ width: '100%' }}>
            <InputLabel>
              <Trans>Shuffle Grouping</Trans>
            </InputLabel>
            <Select
              label={t`Shuffle Grouping`}
              value={shuffleType}
              onChange={(v) =>
                onShuffleTypeChange(v.target.value as ShuffleGroupingValue)
              }
            >
              <MenuItem value={'none'}>
                <Trans>None</Trans>
              </MenuItem>
              <MenuItem value={'show'}>
                <Trans>Show</Trans>
              </MenuItem>
            </Select>
            <FormHelperText>
              <Trans>
                Shuffle programming in a channel, optionally grouping programs
                by certain criteria.
              </Trans>
              <br />
              <ul>
                <li>
                  <strong>
                    <Trans>None:</Trans>
                  </strong>{' '}
                  <Trans>Do not group programs at all. Normal shuffle.</Trans>
                </li>
                <li>
                  <strong>
                    <Trans>Show:</Trans>
                  </strong>{' '}
                  <Trans>Group episode programs by their show.</Trans>
                </li>
              </ul>
            </FormHelperText>
          </FormControl>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          onClick={() => handleShuffle()}
          startIcon={<Shuffle />}
          variant="contained"
        >
          <Trans>Shuffle</Trans>
        </Button>
      </DialogActions>
    </>
  );
};

// The content mounts only while the dialog is open, so it does no work when closed.
export const ShuffleProgrammingModal = ({ open, ...props }: Props) => (
  <Dialog open={open} onClose={props.onClose} fullWidth>
    <ShuffleProgrammingModalContent {...props} />
  </Dialog>
);
