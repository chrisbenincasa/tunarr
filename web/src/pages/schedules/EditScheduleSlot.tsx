import { Stack, Typography } from '@mui/material';
import type { MaterializedScheduleSlot, Schedule } from '@tunarr/types/api';
import { maxBy } from 'lodash-es';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { BreadcrumbsV2 } from '../../components/BreadcrumbsV2.tsx';
import { EditScheduleSlotForm } from '../../components/schedules/EditScheduleSlotForm.tsx';

type Props = {
  schedule: Schedule;
  slot?: MaterializedScheduleSlot;
};

function defaultNewSlot(schedule: Schedule): MaterializedScheduleSlot {
  return {
    type: 'show',
    showId: '',
    cooldownMs: 0,
    slotIndex:
      (maxBy(schedule.slots, (slot) => slot.slotIndex)?.slotIndex ?? -1) + 1,
    weight: 1,
    show: null,
    fillMode: 'fill',
    fillValue: 1,
    slotConfig: {
      order: 'next',
      direction: 'asc',
      seasonFilter: [],
    },
  };
}

export const EditScheduleSlot = ({ schedule, slot }: Props) => {
  return (
    <Stack spacing={2}>
      <BreadcrumbsV2 />
      <Typography variant="h3">{slot ? `Edit Slot` : 'New Slot'}</Typography>
      <PaddedPaper>
        <EditScheduleSlotForm
          schedule={schedule}
          slot={slot ?? defaultNewSlot(schedule)}
        />
      </PaddedPaper>
    </Stack>
  );
};
