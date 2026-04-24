import { SlotProgrammingTooLongWarningDetails } from '@/components/slot_scheduler/SlotProgrammingTooLongWarningDetails.tsx';
import { Trans } from '@lingui/react/macro';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { map } from 'lodash-es';
import type { RandomSlotTableRowType } from '../../model/CommonSlotModels.ts';

type Props = {
  slot: RandomSlotTableRowType | undefined;
  onClose: () => void;
};

export const RandomSlotWarningsDialog = ({ slot, onClose }: Props) => {
  if (!slot) {
    return null;
  }

  const renderWarnings = () => {
    return map(slot.warnings, (warning) => {
      switch (warning.type) {
        case 'program_too_long':
          return (
            <SlotProgrammingTooLongWarningDetails
              slot={slot}
              warning={warning}
              slotType="random"
            />
          );
      }
    });
  };

  return (
    <Dialog open={!!slot} onClose={() => onClose()} fullWidth maxWidth="md">
      <DialogTitle><Trans>Slot Warnings</Trans></DialogTitle>
      <DialogContent>{renderWarnings()}</DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} variant="contained">
          <Trans>Done</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
};
