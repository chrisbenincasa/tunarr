import { Box, Stack, Typography } from '@mui/material';
import type { Schedule } from '@tunarr/types/api';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { BreadcrumbsV2 } from '../../components/BreadcrumbsV2.tsx';
import { EditScheduleForm } from '../../components/schedules/EditScheduleForm.tsx';
import { ScheduleSlotTable } from './ScheduleSlotTable.tsx';

type Props = {
  schedule: Schedule;
};

export const EditSchedulePage = ({ schedule }: Props) => {
  return (
    <Stack spacing={2}>
      <BreadcrumbsV2 />
      <Typography variant="h3">Edit Schedule "{schedule.name}"</Typography>
      <PaddedPaper>
        <EditScheduleForm schedule={schedule} />
      </PaddedPaper>
      <Box>
        <ScheduleSlotTable schedule={schedule} />
      </Box>
    </Stack>
  );
};
