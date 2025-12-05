import type {
  CustomShowProgramOption,
  FillerProgramOption,
  ProgramOption,
  ShowProgramOption,
} from '@/helpers/slotSchedulerUtil.ts';
import { useTimeSlotFormContext } from '@/hooks/useTimeSlotFormContext.ts';
import type {
  ShowTimeSlotViewModel,
  TimeSlotViewModel,
} from '@/model/TimeSlotModels.ts';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import dayjs from 'dayjs';
import { groupBy, isEmpty, maxBy, sortBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import type { Dictionary } from 'ts-essentials';
import { OneDayMillis } from '../../helpers/constants.ts';

export const AddTimeSlotButton = ({
  onAdd,
  programOptions,
  dayOffset,
}: AddTimeSlotButtonProps) => {
  const {
    watch,
    slotArray: { fields: slots, append },
  } = useTimeSlotFormContext();
  const currentPeriod = watch('period');

  const relevantSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (currentPeriod !== 'week') {
        return true;
      }
      const start = OneDayMillis * dayOffset;
      const end = start + OneDayMillis;
      return slot.startTime >= start && slot.startTime < end;
    });
  }, [currentPeriod, dayOffset, slots]);

  const optionsByType = useMemo(() => {
    return groupBy(programOptions, (opt) => opt.type) as Dictionary<
      ProgramOption[],
      ProgramOption['type']
    >;
  }, [programOptions]);

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(relevantSlots, (p) => p.startTime);
    const newStartTime = maxSlot
      ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
      : currentPeriod === 'week'
        ? dayjs.duration(OneDayMillis * dayOffset)
        : dayjs.duration(0);

    const baseSlot = {
      startTime: +newStartTime,
      direction: 'asc' as const,
      order: 'next' as const,
    } as const;

    let newSlot: TimeSlotViewModel;

    if (optionsByType['show'] && !isEmpty(optionsByType['show'])) {
      const opts: ShowProgramOption[] = optionsByType[
        'show'
      ] as ShowProgramOption[];
      newSlot = {
        ...baseSlot,
        type: 'show',
        showId: sortBy(opts, (opt) => opt.value)?.[0].showId,
        show: null,
      } satisfies ShowTimeSlotViewModel;
    } else if (
      optionsByType['custom-show'] &&
      !isEmpty(optionsByType['custom-show'])
    ) {
      const opts: CustomShowProgramOption[] = optionsByType[
        'custom-show'
      ] as CustomShowProgramOption[];

      newSlot = {
        ...baseSlot,
        type: 'custom-show',
        customShowId: sortBy(opts, (opt) => opt.value)?.[0].customShowId,
        customShow: null,
        isMissing: false,
      };
    } else if (optionsByType['filler'] && !isEmpty(optionsByType['filler'])) {
      const opts: FillerProgramOption[] = optionsByType[
        'filler'
      ] as FillerProgramOption[];

      const opt = sortBy(opts, (opt) => opt.value)[0];
      newSlot = {
        ...baseSlot,
        ...opt,
        decayFactor: 0.5,
        durationWeighting: 'linear',
        recoveryFactor: 0.05,
        order: 'shuffle_prefer_short',
        fillerList: null,
        isMissing: false,
      };
    } else if (optionsByType['movie'] && !isEmpty(optionsByType['movie'])) {
      newSlot = {
        ...baseSlot,
        type: 'movie',
        order: 'alphanumeric',
      };
    } else {
      newSlot = {
        ...baseSlot,
        type: 'flex',
      };
    }

    onAdd(newSlot);
    append(newSlot);
  }, [relevantSlots, currentPeriod, dayOffset, optionsByType, onAdd, append]);

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
  onAdd: (slot: TimeSlotViewModel) => void;
  programOptions: ProgramOption[];
  dayOffset: number;
};
