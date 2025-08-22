import {
  ArrowBackIos,
  ArrowForwardIos,
  History,
  Restore,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import type { Dayjs } from 'dayjs';
import dayjs, { duration } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useCallback, useState } from 'react';
import { useInterval, useToggle } from 'usehooks-ts';
import NoChannelsCreated from '../../components/channel_config/NoChannelsCreated.tsx';
import { TvGuide } from '../../components/guide/TvGuide.tsx';
import { roundCurrentTime } from '../../helpers/util.ts';
import useStore from '../../store/index.ts';
import { setGuideDurationState } from '../../store/themeEditor/actions.ts';

dayjs.extend(duration);
dayjs.extend(isBetween);

const SubtractInterval = dayjs.duration(1, 'hour');
const MinDurationMillis = dayjs.duration(1, 'hour').asMilliseconds();
const MaxDurationMillis = dayjs.duration(8, 'hour').asMilliseconds();

type Props = {
  channelId: string; // all | ID
};

const DefaultDuration = dayjs.duration(2, 'hour').asMilliseconds();

export default function GuidePage({ channelId }: Props = { channelId: 'all' }) {
  const guideDuration =
    useStore((state) => state.theme.guideDuration) || DefaultDuration;
  const [start, setStart] = useState(roundCurrentTime(15));
  const [end, setEnd] = useState(start.add(guideDuration, 'ms'));
  const [showStealth, _, setShowStealth] = useToggle(true);
  const duration = +end - +start;

  const zoomIn = useCallback(() => {
    if (end.subtract(SubtractInterval).diff(start) >= MinDurationMillis) {
      setEnd((prevEnd) => {
        const newEnd = prevEnd.subtract(SubtractInterval);
        setGuideDurationState(Math.abs(start.diff(newEnd)));
        return newEnd;
      });
    }
  }, [start, end]);

  const zoomOut = useCallback(() => {
    setEnd((prevEnd) => {
      const newEnd = prevEnd.add(SubtractInterval);
      setGuideDurationState(Math.abs(start.diff(newEnd)));
      return newEnd;
    });
  }, [start]);

  const reset = useCallback(() => {
    setGuideDurationState(DefaultDuration);
    setStart(roundCurrentTime(15));
  }, []);

  const zoomInDisabled =
    end.subtract(SubtractInterval).diff(start) < MinDurationMillis;

  const zoomOutDisabled = end.diff(start) >= MaxDurationMillis;

  const navigateBackward = useCallback(() => {
    setEnd((last) => last.subtract(1, 'hour'));
    setStart((start) => start.subtract(1, 'hour'));
  }, [setEnd, setStart]);

  const navigateForward = useCallback(() => {
    setEnd((last) => last.add(1, 'hour'));
    setStart((start) => start.add(1, 'hour'));
  }, [setEnd, setStart]);

  const navigationDisabled = dayjs().isAfter(start);

  const handleNavigationReset = useCallback(() => {
    const newStart = roundCurrentTime(15);

    setStart(newStart);
    setEnd(newStart.add(guideDuration, 'ms'));
  }, [guideDuration]);

  useInterval(() => {
    // Update start time when half of the guide duration has already played out
    if (dayjs().diff(start) > guideDuration / 2) {
      setStart(roundCurrentTime(15));
      setEnd(roundCurrentTime(15).add(guideDuration));
    }
  }, 60000);

  const handleDayChange = (value: Dayjs | null) => {
    const date = value ?? dayjs();

    setStart((prevStart) =>
      date.hour(prevStart.hour()).minute(prevStart.minute()),
    );
    setEnd((prevEnd) => date.hour(prevEnd.hour()).minute(prevEnd.minute()));
  };

  return (
    <>
      <Typography variant="h3" mb={2}>
        Guide
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }}>
        <Stack
          flexGrow={1}
          alignItems={'center'}
          justifyContent={'flex-start'}
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ my: 1 }}
          spacing={2}
        >
          <FormControl sx={{ m: 1, minWidth: 120 }}>
            <DateTimePicker
              // TODO: Replace with the earliest time the XMLTV was generated
              minDateTime={roundCurrentTime(15)}
              value={start}
              onChange={(v) => handleDayChange(v)}
              label="Guide Start Time"
            />
          </FormControl>
          <Typography>{dayjs.duration(end.diff(start)).humanize()}</Typography>
          {!dayjs().isBetween(start, end) && (
            <Tooltip title={'Reset to current date/time'} placement="top">
              <IconButton onClick={handleNavigationReset}>
                <History />
              </IconButton>
            </Tooltip>
          )}
          <FormControlLabel
            control={
              <Checkbox
                checked={showStealth}
                onChange={(_, checked) => setShowStealth(checked)}
              />
            }
            label="Show Stealth"
          />
        </Stack>
        <Stack
          flexGrow={1}
          alignItems={'center'}
          justifyContent={{ xs: 'center', sm: 'right' }}
          direction={'row'}
          sx={{ my: 1 }}
        >
          {duration !== DefaultDuration && (
            <IconButton onClick={reset}>
              <Restore />
            </IconButton>
          )}
          <IconButton disabled={zoomInDisabled} onClick={zoomIn}>
            <ZoomInIcon />
          </IconButton>
          <IconButton disabled={zoomOutDisabled} onClick={zoomOut}>
            <ZoomOutIcon />
          </IconButton>
          <IconButton disabled={navigationDisabled} onClick={navigateBackward}>
            <ArrowBackIos />
          </IconButton>
          <IconButton onClick={navigateForward}>
            <ArrowForwardIos />
          </IconButton>
        </Stack>
      </Stack>
      <TvGuide
        channelId={channelId}
        start={start}
        end={end}
        showStealth={showStealth}
      />
      <NoChannelsCreated />
    </>
  );
}
