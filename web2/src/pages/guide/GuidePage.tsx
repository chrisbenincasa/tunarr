import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import {
  Box,
  Color,
  IconButton,
  Stack,
  Tooltip,
  Typography,
  styled,
} from '@mui/material';
import { TvGuideProgram, ChannelProgram } from '@tunarr/types';
import dayjs, { Dayjs } from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { useCallback, useState } from 'react';
import { useInterval } from 'usehooks-ts';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { useAllTvGuides } from '../../hooks/useTvGuide.ts';
import { isEmpty, round } from 'lodash-es';

dayjs.extend(duration);

const SubtractInterval = dayjs.duration(1, 'hour');
const MinDurationMillis = dayjs.duration(1, 'hour').asMilliseconds();

const GridParent = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'rgba(0,0,0,0.2)',
  borderWidth: '1px 0 0 1px',
});

const GridChild = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'rgba(0,0,0,0.2)',
  borderWidth: '0 1px 0 0',
});

const GuideItem = styled(GridChild)<{ grey: keyof Color; width: number }>(
  ({ theme, grey, width }) => ({
    display: 'flex',
    alignItems: 'center',
    backgroundColor: theme.palette.grey[grey],
    borderCollapse: 'collapse',
    borderStyle: 'solid',
    borderWidth: '0 1px 1px 0',
    borderColor: 'rgba(0,0,0,0.2)',
    height: '3rem',
    width: `${width}%`,
    transition: 'width 0.5s ease-in',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
  }),
);

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

  const timelineDuration = dayjs.duration(end.diff(start));
  const intervalArray = Array.from(
    Array(timelineDuration.asMinutes() / 30).keys(),
  );

  const {
    isPending,
    error,
    data: channelLineup,
  } = useAllTvGuides({ from: start, to: end });

  useInterval(() => {
    setProgress(calcProgress(start, end));
  }, 60000);

  const zoomOut = useCallback(() => {
    setEnd((last) => last.add(1, 'hours'));
  }, [setEnd]);

  const zoomIn = useCallback(() => {
    if (end.subtract(SubtractInterval).diff(start) >= MinDurationMillis) {
      setEnd((last) => last.subtract(SubtractInterval));
    }
  }, [end, start, setEnd]);

  if (isPending) return 'Loading...';

  if (error) return 'An error occurred!: ' + error.message;

  const renderProgram = (
    program: TvGuideProgram,
    index: number,
    lineup: ChannelProgram[],
  ) => {
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
    const programStart = dayjs(program.start);
    const programEnd = dayjs(program.stop);
    let duration = dayjs.duration(programEnd.diff(programStart));

    // Trim any time that has already played in the current program
    if (index === 0) {
      const trimStart = start.diff(programStart);
      duration = duration.subtract(trimStart, 'ms');
    }

    // Trim any time that goes beyond the current guide end time
    if (index === lineup.length - 1) {
      const trimEnd = programEnd.diff(end);
      duration = duration.subtract(trimEnd, 'ms');
    }

    const pct = round(
      (duration.asMilliseconds() / timelineDuration.asMilliseconds()) * 100.0,
      2,
    );

    const grey = index % 2 === 0 ? 300 : 400;

    return (
      <Tooltip
        key={key}
        title={`Starts at ${programStart.format(
          'h:mm A',
        )} and ends at ${programEnd.format('h:mm A')}`}
        placement="top"
      >
        <GuideItem width={pct} grey={grey} key={key}>
          {title}
        </GuideItem>
      </Tooltip>
    );
  };

  const channels = channelLineup?.map((lineup) => {
    return (
      <Box
        key={lineup.number}
        component="section"
        sx={{
          display: 'flex',
          flex: 1,
          borderStyle: 'solid',
          borderWidth: '1px 0 0 1px',
          borderColor: 'rgba(0,0,0,0.2)',
        }}
      >
        {lineup.programs.map(renderProgram)}
      </Box>
    );
  });

  const zoomDisabled =
    end.subtract(SubtractInterval).diff(start) < MinDurationMillis;

  return (
    <>
      <Typography variant="h3" mb={2}>
        TV Guide
      </Typography>
      <p>
        {start.format('DD/MM/YYYY, h:mm A')} to{' '}
        {end.format('DD/MM/YYYY, h:mm A')}
      </p>
      <IconButton disabled={zoomDisabled} onClick={zoomIn}>
        <ZoomInIcon />
      </IconButton>
      <IconButton onClick={zoomOut}>
        <ZoomOutIcon />
      </IconButton>
      <PaddedPaper>
        <Box display="flex">
          <Box
            display="flex"
            position="relative"
            flexDirection="column"
            sx={{ width: '20%' }}
          >
            <Box sx={{ height: '2rem' }}></Box>
            {channelLineup?.map((channel) => (
              <Stack
                direction={{ sm: 'column', md: 'row' }}
                key={`img-${channel.number}`}
              >
                <Box
                  sx={{ height: '3rem' }}
                  display={'flex'}
                  alignItems={'center'}
                  justifyContent={'center'}
                >
                  <img
                    style={{ maxHeight: '40px' }}
                    src={
                      isEmpty(channel.icon?.path)
                        ? '/dizquetv.png'
                        : channel.icon?.path
                    }
                  />
                </Box>
                <Box
                  sx={{ height: '3rem' }}
                  key={channel.number}
                  display={'flex'}
                  alignItems={'center'}
                  justifyContent={'center'}
                  flexGrow={1}
                >
                  {channel.name}
                </Box>
              </Stack>
            ))}
          </Box>
          <Box
            sx={{
              display: 'flex',
              position: 'relative',
              flexDirection: 'column',
              width: '100%',
              overflowX: 'hidden',
            }}
          >
            <GridParent
              sx={{
                display: 'flex',
                flex: 1,
              }}
            >
              {intervalArray.map((slot) => (
                <GridChild
                  sx={{
                    width: `${100 / intervalArray.length}%`,
                    height: '2rem',
                  }}
                  key={slot}
                >
                  {start.add(slot * 30, 'minutes').format('h:mm A')}
                </GridChild>
              ))}
            </GridParent>
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
        </Box>
      </PaddedPaper>
    </>
  );
}
