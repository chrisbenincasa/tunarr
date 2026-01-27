import { Stack, Typography } from '@mui/material';
import type { MaterializedSchedule2 } from '@tunarr/types/api';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import { ScheduleEditor } from './ScheduleEditor.tsx';

type Props = {
  schedule: MaterializedSchedule2;
};

export const EditSchedulePage = ({ schedule }: Props) => {
  return (
    <Stack spacing={2}>
      <Breadcrumbs routeNameMap={{ schedule_name: schedule.name }} />
      <Typography variant="h3">Edit Schedule "{schedule.name}"</Typography>
      <ScheduleEditor schedule={schedule} />
    </Stack>
  );
};
