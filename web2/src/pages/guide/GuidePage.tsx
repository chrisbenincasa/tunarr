import { Box, Typography } from '@mui/material';
import { useTvGuide } from '../../hooks/useTvGuide.ts';
import { useState } from 'react';
import { TvGuideProgram } from 'dizquetv-types';
import { useInterval } from 'usehooks-ts';
import dayjs, { Dayjs } from 'dayjs';

const renderProgram = (program: TvGuideProgram) => {
  const key = `${program.title}_${program.start}_${program.stop}`;
  return (
    <Box sx={{ height: '3rem' }} key={key}>
      {program.title}
    </Box>
  );
};

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
  const end = start.add(1, 'hours');
  const [progress, setProgress] = useState(() => {
    return calcProgress(start, end);
  });

  const {
    isPending,
    error,
    data: channelLineup,
  } = useTvGuide({ from: start, to: end });

  useInterval(() => {
    setProgress(calcProgress(start, end));
  }, 60000);

  // useInterval(() => {

  // })

  if (isPending) return 'Loading...';

  if (error) return 'An error occurred!: ' + error.message;

  const channels = Object.keys(channelLineup).map((channel) => {
    const lineup = channelLineup[channel];
    return (
      <Box
        display="flex"
        flex={1}
        key={channel}
        component="section"
        sx={{ border: '1px dashed grey' }}
      >
        {lineup.programs.map(renderProgram)}
      </Box>
    );
  });

  return (
    <>
      <p>
        {start.toISOString()} to {end.toISOString()}
      </p>
      <Typography component="h1">
        <Box display="flex" position="relative" flexDirection="column">
          {channels}
          <Box
            sx={{
              position: 'absolute',
              width: '2px',
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 10,
              height: '100%',
              left: `${progress}%`,
            }}
          ></Box>
        </Box>
      </Typography>
    </>
  );
}
