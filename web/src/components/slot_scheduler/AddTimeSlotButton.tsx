import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { TimeSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { maxBy } from 'lodash-es';
import { useCallback } from 'react';
import { UseFieldArrayAppend } from 'react-hook-form';
import { TimeSlotForm } from '../../pages/channels/TimeSlotEditorPage.tsx';

export const AddTimeSlotButton = ({
  slots,
  append,
}: AddTimeSlotButtonProps) => {
  // const currentSlots = useWatch({ control, name: 'slots' });

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(slots, (p) => p.startTime);
    const newStartTime = maxSlot
      ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
      : dayjs.duration(0);

    append({
      programming: { type: 'flex' },
      startTime: newStartTime.asMilliseconds(),
      order: 'next',
    });
  }, [append, slots]);

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
  slots: TimeSlot[];
  append: UseFieldArrayAppend<TimeSlotForm, 'slots'>;
};
