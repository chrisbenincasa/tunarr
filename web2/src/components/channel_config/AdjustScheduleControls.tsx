import {
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material';
import { useContext, useState } from 'react';
import { FastForward, FastRewind, Close } from '@mui/icons-material';
import {
  useFastForwardSchedule,
  useRewindSchedule,
} from '../../hooks/programming_controls/useSlideSchedule.ts';
import { ScheduleControlsContext } from './ChannelProgrammingConfig.tsx';

const AdjustScheduleControls = () => {
  const fastForward = useFastForwardSchedule();
  const rewind = useRewindSchedule();
  const [timeAmount, setTimeAmount] = useState<string>('60000'); // Default to 1 minute
  const { showScheduleControls, setShowScheduleControls } = useContext(
    ScheduleControlsContext,
  );

  return (
    <>
      {showScheduleControls && (
        <>
          <Tooltip title="Hide these controls.  They can be displayed again by selecting them in the Tools menu.">
            <IconButton onClick={() => setShowScheduleControls(false)}>
              <Close />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            onClick={() => rewind(Number(timeAmount))}
            startIcon={<FastRewind />}
          >
            Rewind
          </Button>
          <FormControl>
            <InputLabel id="time-amount-label">Time Amount</InputLabel>
            <Select
              value={timeAmount}
              label="Time Amount"
              labelId="time-amount-label"
              id="time-amount"
              onChange={(e) => setTimeAmount(e.target.value)}
            >
              <MenuItem value="60000">1 minute</MenuItem>
              <MenuItem value="600000">10 minutes</MenuItem>
              <MenuItem value="900000">15 minutes</MenuItem>
              <MenuItem value="1800000">30 minutes</MenuItem>
              <MenuItem value="3600000">1 hour</MenuItem>
              <MenuItem value="7200000">2 hours</MenuItem>
              <MenuItem value="14400000">4 hours</MenuItem>
              <MenuItem value="28800000">8 hours</MenuItem>
              <MenuItem value="43200000">12 hours</MenuItem>
              <MenuItem value="86400000">1 day</MenuItem>
              <MenuItem value="604800000">1 week</MenuItem>
            </Select>
          </FormControl>
          <Button
            variant="contained"
            onClick={() => fastForward(Number(timeAmount))}
            endIcon={<FastForward />}
          >
            Fast Forward
          </Button>
        </>
      )}
    </>
  );
};

export default AdjustScheduleControls;
