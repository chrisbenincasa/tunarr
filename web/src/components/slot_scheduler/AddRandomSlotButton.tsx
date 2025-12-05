import type { ProgramOption } from '@/helpers/slotSchedulerUtil';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext.ts';
import { Add } from '@mui/icons-material';
import { Button } from '@mui/material';
import dayjs from 'dayjs';
import { first, map, round, sortBy } from 'lodash-es';
import { useCallback } from 'react';
import { match } from 'ts-pattern';
import { useSlotProgramOptionsContext } from '../../hooks/programming_controls/useSlotProgramOptions.ts';
import type { SlotViewModel } from '../../model/SlotModels.ts';

const typeWeights: Record<ProgramOption['type'], number> = {
  show: 0,
  movie: 1,
  'custom-show': 2,
  'smart-collection': 2,
  filler: 2,
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

export const AddRandomSlotButton = ({ onAdd }: AddRandomSlotButtonProps) => {
  const { watch, slotArray } = useRandomSlotFormContext();
  const [currentSlots, distribution] = watch(['slots', 'randomDistribution']);
  const programOptions = useSlotProgramOptionsContext();

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

    const baseSlot = {
      type: programOption.type,
      cooldownMs: 0,
      // order: programming.type === 'movie' ? 'chronological' : 'next',
      weight,
      durationSpec: {
        type: 'fixed',
        durationMs: dayjs.duration({ minutes: 30 }).asMilliseconds(),
      },
      direction: 'asc',
      index: slotArray.fields.length,
    } as const;

    const newSlot = match(programOption)
      .returnType<SlotViewModel>()
      .with({ type: 'movie' }, () => ({
        ...baseSlot,
        type: 'movie',
        order: 'chronological',
      }))
      .with({ type: 'custom-show' }, (cs) => ({
        ...baseSlot,
        type: 'custom-show',
        customShowId: cs.customShowId,
        order: 'next',
        customShow: null,
        isMissing: false,
      }))
      .with({ type: 'filler' }, (f) => ({
        ...baseSlot,
        ...f,
        type: 'filler',
        decayFactor: 0.5,
        durationWeighting: 'linear',
        recoveryFactor: 0.05,
        order: 'shuffle_prefer_short',
        fillerList: null,
        isMissing: false,
      }))
      .with({ type: 'show' }, (s) => ({
        ...baseSlot,
        type: 'show',
        showId: s.showId,
        order: 'next',
        show: null,
      }))
      .with({ type: 'flex' }, () => ({
        ...baseSlot,
        type: 'flex',
        order: 'next',
      }))
      .with({ type: 'redirect' }, (r) => ({
        ...baseSlot,
        type: 'redirect',
        channelId: r.channelId,
        order: 'next',
      }))
      .with({ type: 'smart-collection' }, (c) => ({
        ...baseSlot,
        type: 'smart-collection',
        smartCollectionId: c.collectionId,
        order: 'next',
        smartCollection: null,
        isMissing: false,
      }))
      .exhaustive();

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
  onAdd: (slot: SlotViewModel) => void;
};
