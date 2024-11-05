import { Add } from '@mui/icons-material';
import { Button } from '@mui/material';
import { RandomSlot } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { map, round } from 'lodash-es';
import { useCallback } from 'react';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import { RandomSlotForm } from '../../pages/channels/RandomSlotEditorPage';

export const AddRandomSlotButton = ({
  control,
  setValue,
  setWeights,
}: AddRandomSlotButtonProps) => {
  const [currentSlots, distribution] = useWatch({
    control,
    name: ['slots', 'randomDistribution'],
  });

  const addSlot = useCallback(() => {
    let newSlots: RandomSlot[];
    const newSlot: Omit<RandomSlot, 'weight'> = {
      programming: {
        type: 'flex',
      },
      durationMs: dayjs.duration({ minutes: 30 }).asMilliseconds(),
      cooldownMs: 0,
      order: 'next',
    };

    if (distribution === 'uniform') {
      const slot = { ...newSlot, weight: 100 };
      newSlots = [...currentSlots, slot];
    } else {
      const newWeight = round(100 / (currentSlots.length + 1), 2);
      const distributeWeight = round(
        (100 - newWeight) / currentSlots.length,
        2,
      );
      const slot = { ...newSlot, weight: newWeight };
      const oldSlots = map(currentSlots, (slot) => ({
        ...slot,
        weight: distributeWeight,
      }));
      newSlots = [...oldSlots, slot];
    }

    setWeights(map(newSlots, 'weight'));
    setValue('slots', newSlots, { shouldDirty: true });
  }, [distribution, setWeights, setValue, currentSlots]);

  return (
    <Button startIcon={<Add />} variant="contained" onClick={() => addSlot()}>
      Add Slot
    </Button>
  );
};

type AddRandomSlotButtonProps = {
  control: Control<RandomSlotForm>;
  setValue: UseFormSetValue<RandomSlotForm>;
  setWeights: (weights: number[]) => void;
};
