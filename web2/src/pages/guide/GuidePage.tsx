import {
  ArrowBackIos,
  ArrowForwardIos,
  History,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
} from '@mui/icons-material';
import {
  Box,
  Chip,
  CircularProgress,
  Color,
  FormControl,
  IconButton,
  MenuItem,
  Modal,
  Select,
  SelectChangeEvent,
  Stack,
  Tooltip,
  Typography,
  styled,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useQueryClient } from '@tanstack/react-query';
import { TvGuideProgram } from '@tunarr/types';
import dayjs, { Dayjs, duration } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { isEmpty, round } from 'lodash-es';
import { Fragment, useCallback, useState } from 'react';
import { useInterval } from 'usehooks-ts';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { prefetchAllTvGuides, useAllTvGuides } from '../../hooks/useTvGuide.ts';
import useStore from '../../store/index.ts';
import { setGuideDurationState } from '../../store/themeEditor/actions.ts';

dayjs.extend(duration);
dayjs.extend(isBetween);

const GridParent = styled(Box)({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '1px 0 0 1px',
});

const GridChild = styled(Box)<{ width: number }>(({ width }) => ({
  borderStyle: 'solid',
  borderColor: 'transparent',
  borderWidth: '0 1px 0 0',
  width: `${width}%`,
  transition: 'width 0.5s ease-in',
}));

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
    height: '4rem',
    width: `${width}%`,
    // background: `linear-gradient(90deg, rgba(243, 125, 119,1) 1%, rgba(243, 125, 119,1) 7%, rgba(97, 97, 97,1) ${10}%)`,
    transition: 'width 0.5s ease-in',
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    textOverflow: 'ellipsis',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    cursor: 'pointer',
    '&:hover': {
      background: theme.palette.primary.light,
    },
  }),
);

const modalStyle = {
  position: 'absolute' as const,
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 500,
  bgcolor: 'background.paper',
  outline: 'none',
  boxShadow: 24,
  borderRadius: '2%',
  p: 4,
};

const SubtractInterval = dayjs.duration(1, 'hour');
const MinDurationMillis = dayjs.duration(1, 'hour').asMilliseconds();
const MaxDurationMillis = dayjs.duration(8, 'hour').asMilliseconds();

const calcProgress = (start: Dayjs, end: Dayjs): number => {
  const total = end.unix() - start.unix();
  const p = dayjs().unix() - start.unix();
  return round(100 * (p / total), 2);
};

const roundNearestMultiple = (num: number, multiple: number): number => {
  if (multiple <= 0) return 0;

  return Math.floor(num / multiple) * multiple;
};

const roundCurrentTime = (multiple?: number): Dayjs => {
  return dayjs()
    .minute(multiple ? roundNearestMultiple(dayjs().minute(), multiple) : 0)
    .second(0)
    .millisecond(0);
};

export default function GuidePage() {
  const theme = useTheme();
  const guideDuration =
    useStore((state) => state.theme.guideDuration) ||
    dayjs.duration(2, 'hour').asMilliseconds();
  const [start, setStart] = useState(roundCurrentTime(15));
  const [end, setEnd] = useState(start.add(guideDuration, 'ms'));
  const [currentTime, setCurrentTime] = useState(dayjs().format('h:mm'));
  const [progress, setProgress] = useState(calcProgress(start, end));
  const [modalProgram, setModalProgram] = useState<
    TvGuideProgram | undefined
  >();
  const queryClient = useQueryClient();

  const timelineDuration = dayjs.duration(end.diff(start));
  const increments =
    timelineDuration.asMilliseconds() <
    dayjs.duration(4, 'hour').asMilliseconds()
      ? 30
      : 60;
  const intervalArray = Array.from(
    Array(timelineDuration.asMinutes() / increments).keys(),
  );

  console.log(intervalArray);

  const {
    isPending,
    error,
    data: channelLineup,
  } = useAllTvGuides(
    { from: start, to: end },
    { staleTime: dayjs.duration(5, 'minutes').asMilliseconds() },
  );

  const smallViewport = useMediaQuery(theme.breakpoints.down('md'));

  prefetchAllTvGuides(queryClient)(
    {
      from: start.add(1, 'hour'),
      to: end.add(1, 'hour'),
    },
    { staleTime: dayjs.duration(5, 'minutes').asMilliseconds() },
  ).catch(console.error);

  useInterval(() => {
    setProgress(calcProgress(start, end));
    setCurrentTime(dayjs().format('h:mm'));

    // Update start time when half of the guide duration has already played out
    if (dayjs().diff(start) > guideDuration / 2) {
      setStart(roundCurrentTime(15));
      setEnd(roundCurrentTime(15).add(guideDuration));
    }
  }, 60000);

  const zoomIn = useCallback(() => {
    if (end.subtract(SubtractInterval).diff(start) >= MinDurationMillis) {
      setEnd((prevEnd) => {
        const newEnd = prevEnd.subtract(SubtractInterval);
        setGuideDurationState(Math.abs(start.diff(newEnd)));
        setProgress(calcProgress(start, newEnd));
        return newEnd;
      });
    }
  }, [start, end]);

  const zoomOut = useCallback(() => {
    setEnd((prevEnd) => {
      const newEnd = prevEnd.add(1, 'hour');
      setGuideDurationState(Math.abs(start.diff(newEnd)));
      setProgress(calcProgress(start, newEnd));
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

    setCurrentTime(dayjs().format('h:mm'));
  }, [guideDuration]);

  const handleDayChange = (event: SelectChangeEvent<string>) => {
    const day = event.target.value;

    setStart((prevStart) =>
      dayjs(day).hour(prevStart.hour()).minute(prevStart.minute()),
    );
    setEnd((prevEnd) =>
      dayjs(day).hour(prevEnd.hour()).minute(prevEnd.minute()),
    );
  };

  const handleModalOpen = (program: TvGuideProgram | undefined) => {
    setModalProgram(program);
  };

  const handleModalClose = () => {
    setModalProgram(undefined);
  };

  const generateWeek = useCallback(() => {
    const today = dayjs();
    let week: Dayjs[] | [] = [];

    for (let i = 0; i < 7; i++) {
      week = [...week, today.add(i, 'day')];
    }

    return week;
  }, []);

  if (error) return 'An error occurred!: ' + error.message;

  const renderProgram = (
    program: TvGuideProgram,
    index: number,
    lineup: TvGuideProgram[],
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
    let endOfAvailableProgramming = false;

    // Trim any time that has already played from the currently playing program
    if (index === 0) {
      const trimStart = start.diff(programStart);
      duration = duration.subtract(trimStart, 'ms');
    }

    // Calc for final program in lineup
    if (index === lineup.length - 1) {
      // If program goes beyond current guide duration, trim it so we get accurate program durations
      if (programEnd.isAfter(end)) {
        const trimEnd = programEnd.diff(end);
        duration = duration.subtract(trimEnd, 'ms');
      }

      if (programEnd.isBefore(end)) {
        endOfAvailableProgramming = true;
      }
    }

    // Calculate the total duration of programming in the lineup
    // This allows us to properly calculate the width of injected 'no programming available' blocks
    const totalProgramDuration = lineup.reduce(
      (totalDuration, currentProgram, index) => {
        const programStart = dayjs(currentProgram.start);
        const programEnd = dayjs(currentProgram.stop);
        let duration = dayjs.duration(programEnd.diff(programStart));

        if (index === 0 && programStart.isBefore(start)) {
          const trimStart = start.diff(programStart);
          duration = duration.subtract(trimStart, 'ms');
        }

        if (index === lineup.length - 1 && programEnd.isAfter(end)) {
          const trimEnd = programEnd.diff(end);
          duration = duration.subtract(trimEnd, 'ms');
        }

        return totalDuration + duration.asMilliseconds();
      },
      0,
    );

    const finalBlockWidth = round(
      ((timelineDuration.asMilliseconds() - totalProgramDuration) /
        timelineDuration.asMilliseconds()) *
        100.0,
      2,
    );

    const pct = round(
      (duration.asMilliseconds() / timelineDuration.asMilliseconds()) * 100.0,
      2,
    );

    const grey = index % 2 === 0 ? 300 : 400;

    const isPlaying = dayjs().isBetween(programStart, programEnd);
    let remainingTime;

    if (isPlaying) {
      remainingTime = programEnd.diff(dayjs(), 'm');
    }

    return (
      <Fragment key={key}>
        <GuideItem
          width={pct}
          grey={grey}
          onClick={() => handleModalOpen(program)}
        >
          <Box sx={{ fontSize: '14px', fontWeight: '600' }}>{title}</Box>
          <Box sx={{ fontSize: '13px', fontStyle: 'italic' }}>
            {episodeTitle}
          </Box>
          <Box sx={{ fontSize: '12px' }}>
            {`${programStart.format('h:mm')} - ${programEnd.format('h:mma')}`}
            {isPlaying ? ` (${remainingTime}m remaining)` : null}
          </Box>
        </GuideItem>
        {endOfAvailableProgramming
          ? renderUnavailableProgramming(finalBlockWidth)
          : null}
      </Fragment>
    );
  };

  const renderUnavailableProgramming = (width: number) => {
    const lm = theme.palette.mode === 'light';
    return (
      <Tooltip
        title={'No programming scheduled for this time period'}
        placement="top"
      >
        <GuideItem
          width={width}
          grey={100}
          sx={{
            border: 'none',
            background: `repeating-linear-gradient(
              45deg,
              ${theme.palette.grey[lm ? 300 : 700]},
              ${theme.palette.grey[lm ? 300 : 700]} 10px,
              ${theme.palette.grey[lm ? 400 : 800]} 10px,
              ${theme.palette.grey[lm ? 400 : 800]} 20px)`,
          }}
        >
          <Box
            sx={{
              fontSize: '14px',
              fontWeight: '600',
              m: 0.5,
            }}
          >
            No Programming scheduled
          </Box>
        </GuideItem>
      </Tooltip>
    );
  };

  const renderProgramModal = (program: TvGuideProgram | undefined) => {
    if (!program) {
      return;
    }

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

    let rating: string | undefined;
    switch (program.type) {
      case 'custom':
        rating = program.program?.rating ?? '';
        break;
      case 'content':
        rating = program.rating;
        break;
      case 'redirect':
        rating = '';
        break;
      case 'flex':
        rating = '';
        break;
    }

    let summary: string | undefined;
    switch (program.type) {
      case 'custom':
        summary = program.program?.summary ?? '';
        break;
      case 'content':
        summary = program.summary;
        break;
      case 'redirect':
        summary = '';
        break;
      case 'flex':
        summary = '';
        break;
    }

    return (
      <Modal
        open={!!modalProgram}
        onClose={handleModalClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h5" component="h2">
            {title}
          </Typography>
          <Typography
            id="modal-modal-title"
            variant="h6"
            component="h2"
            fontStyle={'italic'}
          >
            {episodeTitle}
          </Typography>
          {program.type === 'content' ? (
            <>
              <Chip
                color="secondary"
                label={`${dayjs(program.duration).format('m')}m`}
                sx={{ mt: 1 }}
              />
              <Chip color="secondary" label={rating} sx={{ mx: 1, mt: 1 }} />
            </>
          ) : null}
          <Typography id="modal-modal-description" sx={{ mt: 1 }}>
            {`${dayjs(program.start).format('h:mm')} - ${dayjs(
              program.stop,
            ).format('h:mma')}`}
          </Typography>
          <Typography id="modal-modal-description" sx={{ mt: 1 }}>
            {summary}
          </Typography>
        </Box>
      </Modal>
    );
  };

  const channels = channelLineup?.map((lineup) => {
    return (
      <Box
        key={lineup.id}
        component="section"
        sx={{
          display: 'flex',
          flex: 1,
          borderStyle: 'solid',
          borderColor: 'transparent',
        }}
      >
        {lineup.programs.length > 0
          ? lineup.programs.map(renderProgram)
          : renderUnavailableProgramming(100)}
      </Box>
    );
  });

  return (
    <>
      <Typography variant="h3" mb={2}>
        TV Guide
      </Typography>
      {renderProgramModal(modalProgram)}
      <Box display={'flex'}>
        <Stack
          flexGrow={1}
          alignItems={'center'}
          justifyContent={'flex-start'}
          direction={'row'}
          sx={{ my: 1 }}
        >
          <FormControl sx={{ m: 1, minWidth: 120 }}>
            <Select
              value={start.format('MM/DD/YYYY')}
              onChange={handleDayChange}
              inputProps={{ 'aria-label': 'Without label' }}
            >
              {generateWeek().map((date, index) => (
                <MenuItem value={date.format('MM/DD/YYYY')} key={index}>
                  {dayjs().isSame(date)
                    ? `Today, ${date.format('MMM D')}`
                    : date.format('dddd, MMM D')}
                </MenuItem>
              ))}
            </Select>
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
      <PaddedPaper>
        <Box display="flex">
          <Box
            display="flex"
            position="relative"
            flexDirection="column"
            sx={{ width: `${smallViewport ? '10%' : '15%'}` }}
          >
            <Box sx={{ height: '4.5rem' }}></Box>
            {channelLineup?.map((channel) => (
              <Stack
                direction={{ sm: 'column', md: 'row' }}
                key={`img-${channel.id}`}
              >
                {!smallViewport ? (
                  <Box
                    sx={{ height: '4rem' }}
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
                ) : null}
                <Box
                  sx={{ height: '4rem' }}
                  key={channel.number}
                  display={'flex'}
                  alignItems={'center'}
                  flexGrow={1}
                  marginLeft={1}
                >
                  {smallViewport ? channel.number : channel.name}
                </Box>
              </Stack>
            ))}
          </Box>
          <Box
            sx={{
              display: 'flex',
              position: 'relative',
              flexDirection: 'column',
              width: `${smallViewport ? '90%' : '85%'}`,
            }}
          >
            <Box
              sx={{
                width: `100%`,
                height: '2rem',
                textAlign: 'center',
                fontWeight: 'bold',
              }}
            >
              {start.format('MMMM D')}
            </Box>
            <GridParent
              sx={{
                display: 'flex',
                flex: 1,
              }}
            >
              {intervalArray.map((slot) => (
                <GridChild
                  width={100 / intervalArray.length}
                  sx={{
                    height: '2rem',
                  }}
                  key={slot}
                >
                  {start
                    .add(slot * increments, 'minutes')
                    .format(`${smallViewport ? 'h:mm' : 'h:mm A'}`)}
                </GridChild>
              ))}
            </GridParent>
            {isPending ? <CircularProgress color="secondary" /> : channels}
            {dayjs().isBetween(start, end) && (
              <Box
                sx={{
                  position: 'absolute',
                  width: '2px',
                  background: theme.palette.primary.main,
                  zIndex: 10,
                  height: '100%',
                  left: `${progress}%`,
                  top: '-2px',
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
