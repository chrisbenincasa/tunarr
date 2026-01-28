import { Stack, Typography } from '@mui/material';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { BreadcrumbsV2 } from '../../components/BreadcrumbsV2.tsx';
import { NewScheduleForm } from '../../components/schedules/NewScheduleForm.tsx';

export const NewSchedulePage = () => {
  return (
    <Stack spacing={2}>
      <BreadcrumbsV2 />
      <Typography variant="h3">New Schedule</Typography>
      <PaddedPaper>
        <NewScheduleForm />
      </PaddedPaper>
    </Stack>
  );
};
