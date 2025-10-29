import { SlotProgrammingTooLongWarningDetails } from '@/components/slot_scheduler/SlotProgrammingTooLongWarningDetails.tsx';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { map } from 'lodash-es';
import type { TimeSlotTableRowType } from '../../model/CommonSlotModels.ts';

type Props = {
  slot: TimeSlotTableRowType | undefined;
  onClose: () => void;
};

export const TimeSlotWarningsDialog = ({ slot, onClose }: Props) => {
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
              slotType="time"
            />
          );
      }
    });
  };

  return (
    <Dialog open={!!slot} onClose={() => onClose()} fullWidth maxWidth="md">
      <DialogTitle>Slot Warnings</DialogTitle>
      <DialogContent>{renderWarnings()}</DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()} variant="contained">
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
};
