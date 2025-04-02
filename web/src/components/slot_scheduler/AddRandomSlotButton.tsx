import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { Add } from '@mui/icons-material';
import { Button } from '@mui/material';
import type { RandomSlot, RandomSlotProgramming } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { first, map, round, sortBy } from 'lodash-es';
import { useCallback } from 'react';

const typeWeights: Record<ProgramOption['type'], number> = {
  show: 0,
  movie: 1,
  'custom-show': 2,
  redirect: 3,
  flex: 4,
} as const;

const findBestProgramOption = (
  programOptions: ProgramOption[],
): ProgramOption => {
  return (
    first(sortBy(programOptions, (opt) => typeWeights[opt.type])) ?? {
      type: 'flex',
      value: 'flex',
      description: 'Flex',
    }
  );
};

function programOptionToSlotProgram(
  program: ProgramOption,
): RandomSlotProgramming {
  switch (program.type) {
    case 'movie':
      return {
        type: 'movie',
      };
    case 'flex':
      return {
        type: 'flex',
      };
    case 'custom-show':
      return {
        type: 'custom-show',
        customShowId: program.customShowId,
      };
    case 'redirect':
      return {
        type: 'redirect',
        channelId: program.channelId,
        channelName: program.channelName,
      };
    case 'show':
      return {
        type: 'show',
        showId: program.showId,
      };
  }
}

export const AddRandomSlotButton = ({
  onAdd,
  programOptions,
}: AddRandomSlotButtonProps) => {
  const { watch, slotArray } = useRandomSlotFormContext();
  const [currentSlots, distribution] = watch(['slots', 'randomDistribution']);

  const addSlot = useCallback(() => {
    let slots = currentSlots;
    let weight: number;
    if (distribution === 'uniform') {
      weight = 100;
    } else {
      const newWeight = round(100 / (currentSlots.length + 1), 2);
      const distributeWeight = round(
        (100 - newWeight) / currentSlots.length,
        2,
      );
      const updatedSlots = map(currentSlots, (slot) => ({
        ...slot,
        weight: distributeWeight,
      }));
      weight = newWeight;
      slots = updatedSlots;
    }

    const programOption = findBestProgramOption(programOptions);

    const programming = programOptionToSlotProgram(programOption);
    const newSlot = {
      programming,
      cooldownMs: 0,
      order: programming.type === 'movie' ? 'chronological' : 'next',
      weight,
      durationSpec: {
        type: 'fixed',
        durationMs: dayjs.duration({ minutes: 30 }).asMilliseconds(),
      },
      direction: 'asc',
      index: slotArray.fields.length,
    } satisfies RandomSlot;

    onAdd(newSlot);
    slotArray.replace([...slots, newSlot]);
  }, [currentSlots, distribution, programOptions, slotArray, onAdd]);

  return (
    <Button startIcon={<Add />} variant="contained" onClick={() => addSlot()}>
      Add Slot
    </Button>
  );
};

type AddRandomSlotButtonProps = {
  onAdd: (slot: RandomSlot) => void;
  programOptions: ProgramOption[];
};
