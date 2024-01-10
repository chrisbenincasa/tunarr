import { Box, IconButton, Typography, useTheme } from '@mui/material';
import { useTvGuide } from '../../hooks/useTvGuide.ts';
import { useCallback, useState } from 'react';
import { TvGuideProgram } from 'dizquetv-types';
import { useInterval } from 'usehooks-ts';
import dayjs, { Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ZoomInIcon from '@mui/icons-material/ZoomIn';

dayjs.extend(duration);

const calcProgress = (start: Dayjs, end: Dayjs): number => {
  const total = end.unix() - start.unix();
  const p = dayjs().unix() - start.unix();
  return Math.round(100 * (p / total));
};

const roundNearestMultiple = (num: number, multiple: number): number => {
  if (multiple <= 0) return 0;

  return Math.floor(num / multiple) * multiple;
};

export default function GuidePage() {
  const now = dayjs();
  const [start] = useState(
    dayjs()
      .minute(roundNearestMultiple(now.minute(), 15))
      .second(0)
      .millisecond(0),
  );
  const [end, setEnd] = useState(start.add(2, 'hours'));
  const [progress, setProgress] = useState(() => {
    return calcProgress(start, end);
  });
  const theme = useTheme();

  const timelineDuration = dayjs.duration(end.diff(start));
  const intervalArray = Array.from(
    Array(timelineDuration.asMinutes() / 30).keys(),
  );

  const {
    isPending,
    error,
    data: channelLineup,
  } = useTvGuide({ from: start, to: end });

  useInterval(() => {
    setProgress(calcProgress(start, end));
  }, 60000);

  const zoomOut = useCallback(() => {
    setEnd((last) => last.add(1, 'hours'));
  }, [setEnd]);

  const zoomIn = useCallback(() => {
    setEnd((last) => last.subtract(1, 'hours'));
  }, [setEnd]);

  if (isPending) return 'Loading...';

  if (error) return 'An error occurred!: ' + error.message;

  const renderProgram = (program: TvGuideProgram, index: number) => {
    let title: string;
    switch (program.type) {
      case 'custom':
        title = program.program?.title ?? 'Custom Program';
        break;
      case 'content':
        title = program.title;
        break;
      case 'redirect':
        title = `Redirect to Channel ${program.channel}`;
        break;
      case 'flex':
        title = 'Flex';
        break;
    }

    const key = `${title}_${program.start}_${program.stop}`;
    const start = dayjs(program.start);
    const end = dayjs(program.stop);
    const duration = dayjs.duration(end.diff(start));

    const pct = Math.round(
      (duration.asMilliseconds() / timelineDuration.asMilliseconds()) * 100.0,
    );

    const grey = index % 2 === 0 ? 200 : 300;

    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: theme.palette.grey[grey],
          borderCollapse: 'collapse',
          border: '1px solid',
          height: '3rem',
          width: `${pct}%`,
          borderColor: 'divider',
          transition: 'width 0.5s ease-in',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
        key={key}
      >
        {title}
      </Box>
    );
  };

  const channels = Object.keys(channelLineup).map((channel) => {
    const lineup = channelLineup[channel];
    return (
      <Box display="flex" flex={1} key={channel} component="section">
        {lineup.programs.map(renderProgram)}
      </Box>
    );
  });

  return (
    <>
      <p>
        {start.toISOString()} to {end.toISOString()}
      </p>
      <IconButton onClick={zoomIn}>
        <ZoomInIcon />
      </IconButton>
      <IconButton onClick={zoomOut}>
        <ZoomOutIcon />
      </IconButton>
      <Typography component="h1">
        <Box display="flex" position="relative" flexDirection="column">
          <Box display="flex" flex={1}>
            {intervalArray.map((slot) => (
              <Box sx={{ width: `${100 / intervalArray.length}%` }} key={slot}>
                {start.add(slot * 30, 'minutes').format('hh:mm:ss')}
              </Box>
            ))}
          </Box>
          {channels}
          <Box
            sx={{
              position: 'absolute',
              width: '2px',
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              height: '100%',
              left: `${progress}%`,
              transition: 'left 0.5s linear',
            }}
          ></Box>
        </Box>
      </Typography>
    </>
  );
}
