import {
  CustomShowProgramOption,
  ProgramOption,
  ShowProgramOption,
} from '@/helpers/slotSchedulerUtil.ts';
import { useTimeSlotFormContext } from '@/hooks/useTimeSlotFormContext.ts';
import AddIcon from '@mui/icons-material/Add';
import { Button } from '@mui/material';
import { TimeSlot, TimeSlotProgramming } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { groupBy, isEmpty, maxBy, sortBy } from 'lodash-es';
import { useCallback, useMemo } from 'react';

export const AddTimeSlotButton = ({
  onAdd,
  programOptions,
}: AddTimeSlotButtonProps) => {
  const {
    slotArray: { fields: slots, append },
  } = useTimeSlotFormContext();

  const optionsByType = useMemo(() => {
    return groupBy(programOptions, (opt) => opt.type);
  }, [programOptions]);

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(slots, (p) => p.startTime);
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
  }, [slots, optionsByType, append, onAdd]);

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
};
