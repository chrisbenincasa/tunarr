import type {
  CustomShowProgramOption,
  ProgramOption,
  ShowProgramOption,
} from '@/helpers/slotSchedulerUtil.ts';
import { useTimeSlotFormContext } from '@/hooks/useTimeSlotFormContext.ts';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import type { TimeSlot, TimeSlotProgramming } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { groupBy, isEmpty, maxBy, sortBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';
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
    return groupBy(programOptions, (opt) => opt.type);
  }, [programOptions]);

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(relevantSlots, (p) => p.startTime);
    const newStartTime = maxSlot
      ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
      : dayjs.duration(0);

    let programming: TimeSlotProgramming;
    if (optionsByType['show'] && !isEmpty(optionsByType['show'])) {
      const opts: ShowProgramOption[] = optionsByType[
        'show'
      ] as ShowProgramOption[];
      programming = {
        type: 'show',
        showId: sortBy(opts, (opt) => opt.value)?.[0].showId,
      };
    } else if (optionsByType['custom'] && !isEmpty(optionsByType['custom'])) {
      const opts: CustomShowProgramOption[] = optionsByType[
        'custom'
      ] as CustomShowProgramOption[];
      programming = {
        type: 'custom-show',
        customShowId: sortBy(opts, (opt) => opt.value)?.[0].customShowId,
      };
    } else if (optionsByType['movie'] && !isEmpty(optionsByType['movie'])) {
      programming = {
        type: 'movie',
      };
    } else {
      programming = {
        type: 'flex',
      };
    }

    const newSlot = {
      programming,
      startTime: newStartTime.asMilliseconds(),
      order: programming.type === 'movie' ? 'chronological' : 'next',
      direction: 'asc',
    } satisfies TimeSlot;
    onAdd(newSlot);
    append(newSlot);
  }, [relevantSlots, optionsByType, onAdd, append]);

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
  programOptions: ProgramOption[];
  dayOffset: number;
};
