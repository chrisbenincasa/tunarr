import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { TimeSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { maxBy } from 'lodash-es';
import { useCallback } from 'react';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { TimeSlotForm } from '../../pages/channels/TimeSlotEditorPage.tsx';

export const AddTimeSlotButton = ({
  control,
  setValue,
}: AddTimeSlotButtonProps) => {
  const currentSlots = useWatch({ control, name: 'slots' });

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(currentSlots, (p) => p.startTime);
    const newStartTime = maxSlot
      ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
      : dayjs.duration(0);

    const newSlots: TimeSlot[] = [
      ...currentSlots,
      {
        programming: { type: 'flex' },
        startTime: newStartTime.asMilliseconds(),
        order: 'next',
      },
    ];

    setValue('slots', newSlots, { shouldDirty: true });
  }, [currentSlots, setValue]);

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
  control: Control<TimeSlotForm>;
  setValue: UseFormSetValue<TimeSlotForm>;
};
