import { Alert, AlertTitle, Stack } from '@mui/material';
import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useMemo } from 'react';
import {
  getInfiniteScheduleItemsOptions,
  getScheduleByIdOptions,
} from '../../generated/@tanstack/react-query.gen.ts';
import { scheduleGenerationResponseToLineupList } from '../../helpers/converters.ts';
import { useChannelEditor } from '../../store/selectors.ts';
import PaddedPaper from '../base/PaddedPaper.tsx';
import { RouterLink } from '../base/RouterLink.tsx';
import ChannelLineupList from './ChannelLineupList.tsx';

export function ChannelScheduleViewer() {
  const { currentEntity: channel } = useChannelEditor();
  const scheduleId = useMemo(() => channel!.scheduleId!, [channel]);
  const schedulesQuery = useSuspenseQuery({
    ...getScheduleByIdOptions({ path: { id: scheduleId } }),
  });

  const scheduleItems = useQuery({
    ...getInfiniteScheduleItemsOptions({
      path: { id: channel!.id },
      query: {
        fromTimeMs: +dayjs().startOf('day'),
        toTimeMs: +dayjs().startOf('day').add(2, 'days'),
      },
    }),
  });

  const lineup = useMemo(() => {
    if (!scheduleItems.data) {
      return [];
    }
    return scheduleGenerationResponseToLineupList(scheduleItems.data);
  }, [scheduleItems.data]);

  return (
    <Stack spacing={2}>
      <Alert severity="info">
        <AlertTitle>
          This channel is using an assigned schedule:{' '}
          <RouterLink
            to="/schedules/$scheduleId"
            params={{ scheduleId: channel!.scheduleId! }}
          >
            {schedulesQuery.data.name}
          </RouterLink>{' '}
          . Programming cannot be edited directly for channels that are assigned
          schedules. The schedule itself should be edited to change programming.
        </AlertTitle>
      </Alert>
      <PaddedPaper>
        <ChannelLineupList
          type="direct"
          programList={lineup}
          enableDnd={false}
          enableRowEdit={false}
          enableRowDelete={false}
          virtualListProps={{
            height: 600,
            itemSize: 35,
            overscanCount: 10,
            width: '100%',
          }}
        />
      </PaddedPaper>
    </Stack>
  );
}
