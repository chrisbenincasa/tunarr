import { Box, Stack } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import dayjs, { Dayjs } from 'dayjs';
import { useSlideSchedule } from '../../hooks/programming_controls/useSlideSchedule.ts';
import { usePreloadedChannelEdit } from '../../hooks/usePreloadedChannel.ts';
import { setChannelStartTime } from '../../store/channelEditor/actions.ts';
import AddProgrammingButton from './AddProgrammingButton.tsx';
import ChannelProgrammingList from './ChannelProgrammingList.tsx';
import { ChannelProgrammingSort } from './ChannelProgrammingSort.tsx';
import { ChannelProgrammingTools } from './ChannelProgrammingTools.tsx';

export function ChannelProgrammingConfig() {
  const { currentEntity: channel } = usePreloadedChannelEdit();

  const slideSchedule = useSlideSchedule();

  const handleStartTimeChange = (value: Dayjs | null) => {
    if (value) {
      const newStartTime = value.unix() * 1000;
      setChannelStartTime(newStartTime);
      const prevStartTime = channel?.startTime;
      if (prevStartTime) {
        const diff = newStartTime - prevStartTime;
        slideSchedule(diff);
      }
    }
  };

  const startTime = channel ? dayjs(channel.startTime) : dayjs();
  return (
    <Box display="flex" flexDirection="column">
      <Box display="flex" justifyContent={'flex-start'}></Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        gap={{ xs: 1 }}
        sx={{
          display: 'flex',
          pt: 1,
          mb: 2,
          columnGap: 1,
          alignItems: 'center',
        }}
      >
        <Box sx={{ mr: { sm: 2 }, flexGrow: 1 }}>
          <DateTimePicker
            label="Programming Start"
            value={startTime}
            onChange={(newDateTime) => handleStartTimeChange(newDateTime)}
            slotProps={{ textField: { size: 'small' } }}
          />
        </Box>
        <ChannelProgrammingTools />
        <ChannelProgrammingSort />
        <AddProgrammingButton />
      </Stack>

      <ChannelProgrammingList
        virtualListProps={{ width: '100%', height: 600, itemSize: 35 }}
      />
    </Box>
  );
}
