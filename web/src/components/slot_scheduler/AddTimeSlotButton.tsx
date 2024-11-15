import { useTimeSlotFormContext } from '@/hooks/useTimeSlotFormContext.ts';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { TimeSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { maxBy } from 'lodash-es';
import { useCallback } from 'react';

export const AddTimeSlotButton = ({ onAdd }: AddTimeSlotButtonProps) => {
  const {
    slotArray: { fields: slots, append },
  } = useTimeSlotFormContext();

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(slots, (p) => p.startTime);
    const newStartTime = maxSlot
      ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
      : dayjs.duration(0);

    const newSlot = {
      programming: { type: 'flex' },
      startTime: newStartTime.asMilliseconds(),
      order: 'next',
    } satisfies TimeSlot;
    append(newSlot);

    onAdd(newSlot);
  }, [append, onAdd, slots]);

  return (
    <Button
      startIcon={<AddIcon />}
      variant="contained"
      onClick={() => addSlot()}
    >
      Add Slot
    </Button>
  );
};

type AddTimeSlotButtonProps = {
  onAdd: (slot: TimeSlot) => void;
};
