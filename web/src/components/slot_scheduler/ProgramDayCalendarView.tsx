import { ArrowBack, ArrowForward, ZoomIn, ZoomOut } from '@mui/icons-material';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { usePrevious } from '@uidotdev/usehooks';
import type dayjs from 'dayjs';
import { range } from 'lodash-es';
import { useCallback, useRef, useState } from 'react';
import { getTextContrast } from '../../helpers/colors.ts';
import { OneDayMillis } from '../../helpers/constants.ts';
import { useGetProgramsForDayFunc } from '../../hooks/calendarHooks.ts';
import { useRandomProgramBackgroundColor } from '../../hooks/colorHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useSuspendedStore } from '../../hooks/useSuspendedStore.ts';
import {
  DefaultBlockHeight,
  LeftDividerWidth,
} from './ProgramWeekCalendarView.tsx';

type Props = {
  calendarState?: dayjs.Dayjs;
  onChange?: (day: dayjs.Dayjs) => void;
};

export const ProgramDayCalendarView = ({
  calendarState: providedCalendarState,
  onChange,
}: Props) => {
  const providedDjs = useDayjs();
  const calRef = useRef<HTMLDivElement | null>(null);

  const prevCalendarDate = usePrevious(!!providedCalendarState);
  const isControlled = !!providedCalendarState;

  if (prevCalendarDate !== null && prevCalendarDate !== isControlled) {
    console.error(
      'Cannot switch between uncontrolled and controlled ProgramCalendarView.',
    );
  }

  const [internalCalendarState, setInternalCalendarState] =
    useState<dayjs.Dayjs>(providedDjs().startOf('day'));
  const calendarState =
    providedCalendarState?.startOf('day') ?? internalCalendarState;

  const [blockHeight, setBlockHeight] = useState(DefaultBlockHeight);
  const fmt = Intl.DateTimeFormat(providedDjs().locale(), {
    hour: 'numeric',
    minute: undefined,
  });

  const moveBackwardDays = useCallback(
    (n: number = 1) => {
      const next = calendarState.subtract(n, 'days');
      onChange?.(next);
      setInternalCalendarState(next);
    },
    [calendarState, onChange],
  );

  const moveForwardDays = useCallback(
    (n: number = 1) => {
      const next = calendarState.add(n, 'days');
      onChange?.(next);
      setInternalCalendarState(next);
    },
    [calendarState, onChange],
  );

  const channel = useSuspendedStore((s) => s.channelEditor.currentEntity);
  const calHeight = calRef?.current?.getBoundingClientRect().height;

  const getCalendarProgramsForDay = useGetProgramsForDayFunc(channel.id);
  const randomBackgroundColor = useRandomProgramBackgroundColor();

  const getProgramsForDay = () => {
    return seq.collect(
      getCalendarProgramsForDay(calendarState),
      ({ duration, howFarIntoDay, actualStartTime, program }) => {
        if (program.type === 'flex') {
          return null;
        }

        const height = (duration / OneDayMillis) * 100;

        const px = (calHeight ?? 0) * (duration / OneDayMillis);
        const dataRows = Math.floor((px - 8) / 15);

        const backgroundColor = randomBackgroundColor(program);

        return (
          <Paper
            key={+actualStartTime}
            sx={{
              position: 'absolute',
              top: `${(howFarIntoDay / OneDayMillis) * 100}%`,
              left: 0,
              width: '90%',
              height: `${height}%`,
              backgroundColor: `${backgroundColor.toString()}`,
              borderRadius: '5px',
              zIndex: 100,
              border: 'thin solid',
              borderColor: 'black',
              cursor: 'pointer',
              color: (theme) =>
                getTextContrast(backgroundColor, theme.palette.mode),
              overflow: 'hidden',
              lineHeight: 1,
              p: 0.5,
            }}
            onClick={
              () => {}
              // program.type === 'content'
              //   ? setOpenProgramDetails(program)
              //   : void 0
            }
            elevation={
              0
              // program.type === 'content' &&
              // openProgramDetails?.id === program.id
              //   ? 10
              //   : 0
            }
          >
            <Box
              component="span"
              sx={{
                fontSize: 'small',
                fontWeight: 'bold',
                textOverflow: 'clip',
                overflowX: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {program.type === 'content'
                ? (program.grandparent?.title ?? program.title)
                : ''}
            </Box>
            {dataRows > 1 && (
              <>
                <br />
                {program.type === 'content' &&
                  program.subtype === 'episode' && (
                    <Box
                      component="span"
                      sx={{
                        fontSize: 'small',
                        fontWeight: 'bold',
                        textOverflow: 'clip',
                        overflowX: 'hidden',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {`S${program.parent?.index}E${program.index}`}
                    </Box>
                  )}
                {program.type === 'content' && program.subtype === 'movie' && (
                  <Box
                    component="span"
                    sx={{
                      fontSize: 'small',
                      fontWeight: 'bold',
                      textOverflow: 'clip',
                      overflowX: 'hidden',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {actualStartTime.format('LT')}
                  </Box>
                )}
              </>
            )}
          </Paper>
        );
      },
    );
  };

  return (
    <Stack sx={{ width: '100%' }} gap={2}>
      <Stack direction="row" alignItems={'center'}>
        <IconButton onClick={() => moveBackwardDays(1)}>
          <ArrowBack />
        </IconButton>
        <IconButton onClick={() => moveForwardDays(1)}>
          <ArrowForward />
        </IconButton>
        <Typography variant="h5" flex={1}>
          {calendarState.format('LL')}
        </Typography>
        <Box alignSelf="flex-end">
          <IconButton onClick={() => setBlockHeight((prev) => prev - 8)}>
            <ZoomOut />
          </IconButton>
          <IconButton onClick={() => setBlockHeight((prev) => prev + 8)}>
            <ZoomIn />
          </IconButton>
        </Box>
      </Stack>
      <Stack direction="row">
        <Stack sx={{ width: `${blockHeight}px` }}>
          {range(0, 24).map((hour) => (
            <Box
              sx={{
                height: `${blockHeight}px`,
                lineHeight: 1,
              }}
              key={`side_hour_${hour}`}
            >
              <Box
                component="span"
                sx={{ position: 'relative', top: '-6px', fontSize: '0.9rem' }}
              >
                {hour === 0
                  ? null
                  : fmt.format(calendarState.hour(hour).toDate())}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack
          sx={{
            '--Grid-borderWidth': '1px',
            borderColor: 'divider',
            overflowY: 'scroll',
            flex: 1,
          }}
          direction="row"
          ref={calRef}
        >
          <Stack sx={{ width: `${LeftDividerWidth}px` }}>
            {range(0, 24).map((idx) => (
              <Box
                key={`divider_small_${idx}`}
                sx={{
                  height: `${blockHeight}px`,
                  '--Grid-borderWidth': '1px',
                  borderTop: 'var(--Grid-borderWidth) solid',
                  borderColor: 'divider',
                }}
              ></Box>
            ))}
          </Stack>

          <Stack
            sx={{
              width: `100%`,
              '--Grid-borderWidth': '1px',
              borderTop: 'var(--Grid-borderWidth) solid',
              borderLeft: 'var(--Grid-borderWidth) solid',
              borderColor: 'divider',
              zIndex: 0,
              position: 'relative',
            }}
          >
            {range(0, 24).map((hour) => (
              <Box
                sx={{
                  height: `${blockHeight}px`,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  position: 'relative',
                }}
                key={`hour_${hour}`}
              ></Box>
            ))}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            >
              {getProgramsForDay()}
            </Box>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
};
