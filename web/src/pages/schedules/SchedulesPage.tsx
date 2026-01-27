import { Stack, Typography } from '@mui/material';
import { SchedulesTable } from '../../components/schedules/SchedulesTable.tsx';

export const SchedulesPage = () => {
  return (
    <Stack gap={2}>
      <Typography variant="h3">Schedules</Typography>
      <SchedulesTable />
    </Stack>
  );
};
