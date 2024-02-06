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
import isBetween from 'dayjs/plugin/isBetween';
import { useCallback, useState } from 'react';
import { useInterval } from 'usehooks-ts';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { useAllTvGuides } from '../../hooks/useTvGuide.ts';
import { isEmpty, round } from 'lodash-es';
import { ArrowBackIos, ArrowForwardIos } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

dayjs.extend(duration);
dayjs.extend(isBetween);

const SubtractInterval = dayjs.duration(1, 'hour');
const MinDurationMillis = dayjs.duration(1, 'hour').asMilliseconds();

const GridParent = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '1px 0 0 1px',
});

const GridChild = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '0 1px 0 0',
});

const GuideItem = styled(GridChild)<{ grey: keyof Color; width: number }>(
  ({ theme, grey, width }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    backgroundColor:
      theme.palette.mode === 'light'
        ? theme.palette.grey[grey]
        : grey === 300
        ? theme.palette.grey[700]
        : theme.palette.grey[800],
    borderCollapse: 'collapse',
    borderStyle: 'solid',
    borderWidth: '2px 5px 2px 5px',
    borderColor: 'transparent',
    borderRadius: '5px',
    margin: 1,
    padding: 1,
    height: '3rem',
    width: `${width}%`,
    transition: 'width 0.5s ease-in',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    cursor: 'pointer',
  }),
);

const calcProgress = (start: Dayjs, end: Dayjs): number => {
  const total = end.unix() - start.unix();
  const p = dayjs().unix() - start.unix();
  return round(100 * (p / total), 2);
};

const roundNearestMultiple = (num: number, multiple: number): number => {
  if (multiple <= 0) return 0;

  return Math.floor(num / multiple) * multiple;
};

export default function GuidePage() {
  const theme = useTheme();
  const now = dayjs();
  const [start, setStart] = useState(
    dayjs()
      .minute(roundNearestMultiple(now.minute(), 15))
      .second(0)
      .millisecond(0),
  );
  const [end, setEnd] = useState(start.add(2, 'hours'));
  const [currentTime, setCurrentTime] = useState(dayjs().format('h:mm'));
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
    setCurrentTime(dayjs().format('h:mm'));
  }, 60000);

  const zoomOut = useCallback(() => {
    setEnd((last) => last.add(1, 'hours'));
  }, [setEnd]);

  const zoomIn = useCallback(() => {
    if (end.subtract(SubtractInterval).diff(start) >= MinDurationMillis) {
      setEnd((last) => last.subtract(SubtractInterval));
    }
  }, [end, start, setEnd]);

  const navigateForward = useCallback(() => {
    setEnd((last) => last.add(1, 'hours'));
    setStart((start) => start.add(1, 'hours'));
  }, [end, start, setEnd, setStart]);

  const navigateBackward = useCallback(() => {
    setEnd((last) => last.subtract(1, 'hours'));
    setStart((start) => start.subtract(1, 'hours'));
  }, [end, start, setEnd, setStart]);

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

    let episodeTitle: string | undefined;
    switch (program.type) {
      case 'custom':
        episodeTitle = program.program?.episodeTitle ?? '';
        break;
      case 'content':
        episodeTitle = program.episodeTitle;
        break;
      case 'redirect':
        episodeTitle = '';
        break;
      case 'flex':
        episodeTitle = '';
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
          <Box sx={{ fontSize: '14px', fontWeight: '600' }}>{title}</Box>
          <Box sx={{ fontSize: '13px', fontStyle: 'italic' }}>
            {episodeTitle}
          </Box>
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
          borderColor: 'transparent',
        }}
      >
        {lineup.programs.map(renderProgram)}
      </Box>
    );
  });

  const zoomDisabled =
    end.subtract(SubtractInterval).diff(start) < MinDurationMillis;

  const navigationDisabled = now.isAfter(start);

  return (
    <>
      <Typography variant="h3" mb={2}>
        TV Guide
      </Typography>
      <p>
        {start.format('DD/MM/YYYY, h:mm A')} to{' '}
        {end.format('DD/MM/YYYY, h:mm A')}
      </p>

      <Stack justifyContent={'right'} direction={'row'} sx={{ my: 1 }}>
        <IconButton disabled={zoomDisabled} onClick={zoomIn}>
          <ZoomInIcon />
        </IconButton>
        <IconButton onClick={zoomOut}>
          <ZoomOutIcon />
        </IconButton>
        <IconButton disabled={navigationDisabled} onClick={navigateBackward}>
          <ArrowBackIos />
        </IconButton>
        <IconButton onClick={navigateForward}>
          <ArrowForwardIos />
        </IconButton>
      </Stack>
      <PaddedPaper>
        <Box display="flex">
          <Box
            display="flex"
            position="relative"
            flexDirection="column"
            sx={{ width: '15%' }}
          >
            <Box sx={{ height: '2.75rem' }}></Box>
            {channelLineup?.map((channel) => (
              <Stack
                direction={{ sm: 'column', md: 'row' }}
                key={`img-${channel.number}`}
              >
                <Box
                  sx={{ height: '3.5rem' }}
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
                  flexGrow={1}
                  marginLeft={1}
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
            {dayjs().isBetween(start, end) && (
              <Box
                sx={{
                  position: 'absolute',
                  width: '2px',
                  background: theme.palette.primary.main,
                  zIndex: 10,
                  height: '100%',
                  left: `${progress}%`,
                  top: '4px',
                  transition: 'left 0.5s linear',
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    left: '-25px',
                    background: theme.palette.primary.main,
                    color: '#fff',
                    width: '50px',
                    borderRadius: '5px',
                    fontSize: '14px',
                    textAlign: 'center',
                  }}
                >
                  {currentTime}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </PaddedPaper>
    </>
  );
}
