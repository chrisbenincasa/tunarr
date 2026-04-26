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
import { Trans, useLingui } from '@lingui/react/macro';

type AddPaddingModalProps = {
  open: boolean;
  onClose: () => void;
};

const AddPaddingModal = ({ open, onClose }: AddPaddingModalProps) => {
  const { t } = useLingui();
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
      <DialogTitle><Trans>Pad Start Times</Trans></DialogTitle>
      <DialogContent sx={{ py: 0 }}>
        <DialogContentText>
          <Trans>Adds Flex breaks after each TV episode or movie to ensure that the
          program starts at one of the allowed minute marks.</Trans>
        </DialogContentText>
        <FormGroup sx={{ flexGrow: 1, flexWrap: 'nowrap' }}>
          <FormControl fullWidth sx={{ my: 1 }}>
            <InputLabel><Trans>Pad Start Times</Trans></InputLabel>
            <Select<StartTimePadding['key']>
              value={currentPadding?.key ?? -1}
              label={t`Pad Start Times`}
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
        <Button onClick={() => onClose()}><Trans>Cancel</Trans></Button>
        <Button
          onClick={() => {
            padStartTimes(currentPadding);
            onClose();
          }}
          startIcon={<PaddingIcon />}
          variant="contained"
        >
          <Trans>Add Padding</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddPaddingModal;
