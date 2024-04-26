import {
  ArrowBackIos,
  ArrowForwardIos,
  History,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import {
  Box,
  FormControl,
  IconButton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { Dayjs, duration } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { useCallback, useState } from 'react';
import { useInterval } from 'usehooks-ts';
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

export default function GuidePage({ channelId }: Props = { channelId: 'all' }) {
  const guideDuration =
    useStore((state) => state.theme.guideDuration) ||
    dayjs.duration(2, 'hour').asMilliseconds();
  const [start, setStart] = useState(roundCurrentTime(15));
  const [end, setEnd] = useState(start.add(guideDuration, 'ms'));

  const zoomIn = useCallback(() => {
    if (end.subtract(SubtractInterval).diff(start) >= MinDurationMillis) {
      setEnd((prevEnd) => {
        const newEnd = prevEnd.subtract(SubtractInterval);
        setGuideDurationState(Math.abs(start.diff(newEnd)));
        // setProgress(calcProgress(start, newEnd));
        return newEnd;
      });
    }
  }, [start, end]);

  const zoomOut = useCallback(() => {
    setEnd((prevEnd) => {
      const newEnd = prevEnd.add(1, 'hour');
      setGuideDurationState(Math.abs(start.diff(newEnd)));
      // setProgress(calcProgress(start, newEnd));
      return newEnd;
    });
  }, [start]);

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
      <Typography variant="h4" mb={2}>
        TV Guide
      </Typography>
      <Box display={'flex'}>
        <Stack
          flexGrow={1}
          alignItems={'center'}
          justifyContent={'flex-start'}
          direction={'row'}
          sx={{ my: 1 }}
        >
          <FormControl sx={{ m: 1, minWidth: 120 }}>
            <DatePicker
              disablePast
              value={start}
              onChange={(v) => handleDayChange(v)}
              label="Guide Start Time"
            />
          </FormControl>
          {!dayjs().isBetween(start, end) && (
            <Tooltip title={'Reset to current date/time'} placement="top">
              <IconButton onClick={handleNavigationReset}>
                <History />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Stack
          flexGrow={1}
          alignItems={'center'}
          justifyContent={'right'}
          direction={'row'}
          sx={{ my: 1 }}
        >
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
      </Box>
      <TvGuide channelId={channelId} start={start} end={end} />
      <NoChannelsCreated />
    </>
  );
}
