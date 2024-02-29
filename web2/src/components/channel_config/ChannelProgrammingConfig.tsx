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
import {
  resetLineup,
  setChannelStartTime,
} from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import ChannelProgrammingList from './ChannelProgrammingList.tsx';
import ProgrammingSelectorDialog from './ProgrammingSelectorDialog.tsx';
import Delete from '@mui/icons-material/Delete';
import { useRemoveDuplicates } from '../../hooks/programming_controls/useRemoveDuplicates.ts';
import { range } from 'lodash-es';
import { useRestrictHours } from '../../hooks/programming_controls/useRestrictHours.ts';
import { FastForward, FastRewind } from '@mui/icons-material';
import {
  useFastForwardSchedule,
  useRewindSchedule,
} from '../../hooks/programming_controls/useSlideSchedule.ts';

// dayjs.extend(duration);
import { ChannelProgrammingSort } from './ChannelProgrammingSort.tsx';
import { ChannelProgrammingTools } from './ChannelProgrammingTools.tsx';
import AddProgrammingButton from './AddProgrammingButton.tsx';

export function ChannelProgrammingConfig() {
  const { currentEntity: channel, programList } = useStore(
    (s) => s.channelEditor,
  );

  const programsDirty = useStore((s) => s.channelEditor.dirty.programs);

  const handleStartTimeChange = (value: string) => {
    setChannelStartTime(dayjs(value).unix() * 1000);
  };

  // const restrictHours = useRestrictHours();

  // const fastForward = useFastForwardSchedule();
  // const rewind = useRewindSchedule();

  const startTime = channel ? dayjs(channel.startTime) : dayjs();
  const endTime = startTime.add(channel?.duration ?? 0, 'milliseconds');

  return (
    <Box display="flex" flexDirection="column">
      <Paper sx={{ p: 2 }}>
        <Box display="flex">
          <FormControl margin="normal" sx={{ flex: 1, mr: 2 }}>
            <InputLabel>Programming Start</InputLabel>
            <Input
              type="datetime-local"
              value={startTime.format('YYYY-MM-DDTHH:mm:ss')}
              onChange={(e) => handleStartTimeChange(e.target.value)}
            />
          </FormControl>
          <FormControl margin="normal" sx={{ flex: 1 }}>
            <InputLabel>Programming End</InputLabel>
            <Input
              disabled
              type="datetime-local"
              value={endTime.format('YYYY-MM-DDTHH:mm:ss')}
            />
          </FormControl>
          {/* <Select>
                  {range(0, 24).map((hour) => (
                    <MenuItem key={hour}>{`${hour}:00`}</MenuItem>
                  ))}
                </Select>
                <Select>
                  {range(0, 24).map((hour) => (
                    <MenuItem key={hour}>{`${hour}:00`}</MenuItem>
                  ))}
                </Select>
                <Button
                  variant="contained"
                  startIcon={<Delete />}
                  onClick={() => restrictHours(5, 8)}
                >
                  Restrict Hours
                </Button>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  variant="contained"
                  onClick={() => fastForward(60 * 1000)}
                  startIcon={<FastForward />}
                >
                  Fast Forward
                </Button>
              </Grid2>
              <Grid2 xs={3}>
                <Button
                  variant="contained"
                  onClick={() => rewind(60 * 1000)}
                  startIcon={<FastRewind />}
                >
                  Rewind
                </Button>
              </Grid2> */}
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
  );
}
