import { Stack, Typography } from '@mui/material';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { NewScheduleForm } from '../../components/schedules/NewScheduleForm.tsx';

export const NewSchedulePage = () => {
  return (
    <Stack spacing={2}>
      <Breadcrumbs />
      <Typography variant="h3">New Schedule</Typography>
      <PaddedPaper>
        <NewScheduleForm />
      </PaddedPaper>
    </Stack>
  );
};
