import {
  Box,
  Button,
  FormControl,
  Input,
  InputLabel,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import dayjs from 'dayjs';
import { createContext, useState } from 'react';
import {
  resetLineup,
  setChannelStartTime,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import AddProgrammingButton from './AddProgrammingButton.tsx';
import AdjustScheduleControls from './AdjustScheduleControls.tsx';
import ChannelProgrammingList from './ChannelProgrammingList.tsx';
import { ChannelProgrammingSort } from './ChannelProgrammingSort.tsx';
import { ChannelProgrammingTools } from './ChannelProgrammingTools.tsx';

type ScheduleControlsType = {
  showScheduleControls: boolean;
  setShowScheduleControls: React.Dispatch<React.SetStateAction<boolean>>;
};

export const ScheduleControlsContext = createContext<ScheduleControlsType>({
  showScheduleControls: false,
  setShowScheduleControls: () => {},
});

export function ChannelProgrammingConfig() {
  const { currentEntity: channel, programList } = useStore(
    (s) => s.channelEditor,
  );

  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);

  const handleStartTimeChange = (value: string) => {
    setChannelStartTime(dayjs(value).unix() * 1000);
  };

  const startTime = channel ? dayjs(channel.startTime) : dayjs();
  const endTime = startTime.add(channel?.duration ?? 0, 'milliseconds');

  const [showScheduleControls, setShowScheduleControls] =
    useState<boolean>(false);

  return (
    <ScheduleControlsContext.Provider
      value={{
        showScheduleControls,
        setShowScheduleControls,
      }}
    >
      <Box display="flex" flexDirection="column">
        <Paper sx={{ p: 2 }}>
          <Box display="flex" justifyContent={'flex-start'}>
            <FormControl margin="normal" sx={{ flex: 1, mr: 2, maxWidth: 350 }}>
              <InputLabel>Programming Start</InputLabel>
              <Input
                type="datetime-local"
                value={startTime.format('YYYY-MM-DDTHH:mm')}
                onChange={(e) => handleStartTimeChange(e.target.value)}
              />
            </FormControl>
            <FormControl margin="normal" sx={{ flex: 1, maxWidth: 350 }}>
              <InputLabel>Programming End</InputLabel>
              <Input
                disabled
                type="datetime-local"
                value={endTime.format('YYYY-MM-DDTHH:mm')}
              />
            </FormControl>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              sx={{
                display: 'flex',
                pt: 1,
                mb: 2,
                columnGap: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                flexGrow: 1,
              }}
            >
              <AdjustScheduleControls />
            </Stack>
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            sx={{
              display: 'flex',
              pt: 1,
              mb: 2,
              columnGap: 1,
              alignItems: 'center',
            }}
          >
            <Typography variant="caption" sx={{ flexGrow: 1 }}>
              {programList.length} program{programList.length === 1 ? '' : 's'}
            </Typography>
            <Button
              variant="contained"
              onClick={() => resetLineup()}
              disabled={!programsDirty}
            >
              Reset
            </Button>
            <ChannelProgrammingTools />
            <ChannelProgrammingSort />
            <AddProgrammingButton />
          </Stack>

          <ChannelProgrammingList
            virtualListProps={{ width: '100%', height: 400, itemSize: 35 }}
          />
        </Paper>
      </Box>
    </ScheduleControlsContext.Provider>
  );
}
