import { Box, Typography } from '@mui/material';
import { useTvGuide } from '../../hooks/useTvGuide.ts';
import { useState } from 'react';
import { TvGuideProgram } from 'dizquetv-types';

const renderProgram = (program: TvGuideProgram) => {
  console.log(program.start, program.stop);
  const key = `${program.title}_${program.start}_${program.stop}`;
  return (
    <Box sx={{ border: '1px solid black' }} key={key}>
      {program.title}
    </Box>
  );
};

export default function GuidePage() {
  const [now] = useState(() => {
    const now = new Date();
    now.setMinutes(0);
    now.setMilliseconds(0);
    now.setSeconds(0);
    return now;
  });

  const oneDay = new Date(now);
  oneDay.setHours(oneDay.getHours() + 3);

  const {
    isPending,
    error,
    data: channelLineup,
  } = useTvGuide({ from: now, to: oneDay });

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
        sx={{ p: 2, border: '1px dashed grey' }}
      >
        {channel}
        {lineup.programs.map(renderProgram)}
      </Box>
    );
  });

  return (
    <>
      <p>
        {now.toISOString()} to {oneDay.toISOString()}
      </p>
      <Typography component="h1">
        <Box display="flex" flexDirection="column">
          {channels}
        </Box>
      </Typography>
    </>
  );
}
