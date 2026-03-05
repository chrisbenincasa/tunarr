import { Box } from '@mui/material';
import type { MaterializedSchedule2, Schedule } from '@tunarr/types/api';
import { FormProvider, useForm } from 'react-hook-form';
import { v4 } from 'uuid';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { EditScheduleForm } from '../../components/schedules/EditScheduleForm.tsx';
import { SchedulePreview } from './SchedulePreview.tsx';
import { ScheduleSlotTable } from './ScheduleSlotTable.tsx';

function newSchedule() {
  return {
    uuid: v4(),
    name: 'New Schedule',
    bufferDays: 2,
    bufferThresholdDays: 1,
    createdAt: null,
    enabled: true,
    flexPreference: 'end',
    padToMultiple: 1,
    slots: [],
    timeZoneOffset: new Date().getTimezoneOffset(),
    updatedAt: null,
    slotPlaybackOrder: 'ordered',
  } satisfies Schedule;
}

type Props = {
  schedule: MaterializedSchedule2;
};

export const ScheduleEditor = ({ schedule }: Props) => {
  const form = useForm<Schedule>({
    defaultValues: schedule ?? newSchedule(),
  });

  return (
    <FormProvider {...form}>
      <PaddedPaper>
        <EditScheduleForm schedule={schedule} />
      </PaddedPaper>
      <Box>
        <ScheduleSlotTable schedule={schedule} />
      </Box>
      <PaddedPaper>
        <SchedulePreview schedule={schedule} />
      </PaddedPaper>
    </FormProvider>
  );
};
