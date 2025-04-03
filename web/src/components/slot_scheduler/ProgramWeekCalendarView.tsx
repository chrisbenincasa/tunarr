import { ArrowBack, ArrowForward, ZoomIn, ZoomOut } from '@mui/icons-material';
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { ContentProgram } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import 'dayjs/plugin/duration';
import 'dayjs/plugin/localeData';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { range } from 'lodash-es';
import { useCallback, useMemo, useRef, useState } from 'react';
import { match, P } from 'ts-pattern';
import { pickRandomColor, RandomPastels } from '../../helpers/colors.ts';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';
import { useGetProgramsForDayFunc } from '../../hooks/calendarHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useSuspendedStore } from '../../hooks/useSuspendedStore.ts';
import ProgramDetailsDialog from '../ProgramDetailsDialog.tsx';

dayjs.extend(weekOfYear);
dayjs.extend(dayOfYear);

const OneDayMillis = dayjs.duration(1, 'day').asMilliseconds();

const DayWidth = 145;
export const DefaultBlockHeight = 48;
export const LeftDividerWidth = 8;

type Props = {
  calendarState?: dayjs.Dayjs;
  onChange?: (day: dayjs.Dayjs) => void;
  onSelectDay?: (day: dayjs.Dayjs) => void;
};

function isSameDay(l: dayjs.Dayjs, r: dayjs.Dayjs) {
  return (
    l.year() === r.year() && l.month() === r.month() && l.date() === r.date()
  );
}

export const ProgramWeekCalendarView = ({
  calendarState: providedCalendarState,
  onChange,
  onSelectDay,
}: Props) => {
  const providedDjs = useDayjs();
  const now = providedDjs();
  const localeData = useMemo(() => providedDjs().localeData(), [providedDjs]);
  const prevCalendarDate = usePrevious(!!providedCalendarState);
  const isControlled = !!providedCalendarState;

  if (prevCalendarDate !== null && prevCalendarDate !== isControlled) {
    console.error(
      'Cannot switch between uncontrolled and controlled ProgramCalendarView.',
    );
  }

  const [internalCalendarState, setInternalCalendarState] =
    useState<dayjs.Dayjs>(providedDjs().startOf('week'));
  const calendarState =
    providedCalendarState?.startOf('week') ?? internalCalendarState;
  const [blockHeight, setBlockHeight] = useState(DefaultBlockHeight);

  const [openProgramDetails, setOpenProgramDetails] =
    useState<ContentProgram | null>(null);

  const startOfWeek = useMemo(
    () => calendarState.startOf('week'),
    [calendarState],
  );

  const channel = useSuspendedStore((s) => s.channelEditor.currentEntity);
  const calRef = useRef<HTMLDivElement | null>(null);

  const fmt = Intl.DateTimeFormat(providedDjs().locale(), {
    hour: 'numeric',
    minute: undefined,
  });

  const calHeight = calRef?.current?.getBoundingClientRect().height;

  const getCalendarProgramsForDay = useGetProgramsForDayFunc(channel.id);

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

  const getProgramsForDay = (day: dayjs.Dayjs) => {
    return seq.collect(
      getCalendarProgramsForDay(day),
      ({ duration, howFarIntoDay, actualStartTime, program }) => {
        if (program.type === 'flex') return null;

        const height = (duration / OneDayMillis) * 100;

        const px = (calHeight ?? 0) * (duration / OneDayMillis);
        const dataRows = Math.floor((px - 8) / 15);

        const bgColor = pickRandomColor(
          getProgramGroupingKey(program),
          RandomPastels,
        ).hex();
        return (
          <Paper
            key={+actualStartTime}
            sx={{
              position: 'absolute',
              top: `${(howFarIntoDay / OneDayMillis) * 100}%`,
              left: 0,
              width: '90%',
              height: `${height}%`,
              backgroundColor: `${bgColor}`,
              borderRadius: '5px',
              zIndex: 100,
              border: 'thin solid',
              borderColor: 'black',
              cursor: 'pointer',
              color: (theme) => theme.palette.getContrastText(bgColor),
              overflow: 'hidden',
              lineHeight: 1,
              p: 0.5,
            }}
            onClick={() =>
              program.type === 'content'
                ? setOpenProgramDetails(program)
                : void 0
            }
            elevation={
              program.type === 'content' &&
              openProgramDetails?.id === program.id
                ? 10
                : 0
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
                      {`S${program.parent?.index?.toString().padStart(2, '0')}E${program.index?.toString().padStart(2, '0')}`}
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

  const end = calendarState.add(1, 'week').subtract(1, 'day');

  const getCalendarHeader = () => {
    const sameMonth = end.month() === calendarState.month();
    const sameYear = end.year() === calendarState.year();

    return match([sameMonth, sameYear])
      .with([true, true], () => `${calendarState.format('MMM YYYY')}`)
      .with(
        [false, true],
        () =>
          `${calendarState.format('MMM')} - ${end.format('MMM')} ${calendarState.format('YYYY')}`,
      )
      .with(
        [P._, false],
        () => `${calendarState.format('MMM YYYY')} - ${end.format('MMM YYYY')}`,
      )
      .exhaustive();
  };

  const renderWeekHeader = (idx: number) => {
    const weekDay = startOfWeek.add(idx, 'days');
    const isToday = isSameDay(weekDay, now);
    return (
      <Box
        key={`week_header_${idx}`}
        sx={{ textAlign: 'center', width: `${DayWidth}px` }}
      >
        <Typography component="span">
          {localeData.weekdaysShort()[idx]}
        </Typography>
        <br />
        <Typography
          component="span"
          variant="h5"
          sx={{
            backgroundColor: (theme) =>
              isToday ? theme.palette.primary.main : 'transparent',
            color: (theme) =>
              isToday
                ? theme.palette.getContrastText(theme.palette.primary.main)
                : theme.palette.text.primary,
            '&:hover': {
              cursor: 'pointer',
              backgroundColor: (theme) =>
                !isToday ? theme.palette.grey[300] : undefined,
            },
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          onClick={() => onSelectDay?.(weekDay)}
        >
          {weekDay.date()}
        </Typography>
      </Box>
    );
  };

  return (
    <Stack sx={{ width: '100%' }} gap={2}>
      <Stack direction="row">
        <Typography variant="h5" flex={1}>
          {getCalendarHeader()}
        </Typography>
        <Box alignSelf={'flex-end'}>
          <IconButton onClick={() => moveBackwardDays(7)}>
            <ArrowBack />
          </IconButton>
          <IconButton onClick={() => setBlockHeight((prev) => prev - 8)}>
            <ZoomOut />
          </IconButton>
          <IconButton onClick={() => setBlockHeight((prev) => prev + 8)}>
            <ZoomIn />
          </IconButton>
          <IconButton onClick={() => moveForwardDays(7)}>
            <ArrowForward />
          </IconButton>
        </Box>
      </Stack>
      <Stack direction="row">
        <Box sx={{ width: `${blockHeight}px` }}></Box>
        <Stack
          sx={{
            '--Grid-borderWidth': '1px',
            flex: 1,
          }}
          direction="row"
        >
          {range(0, 7).map((idx) => renderWeekHeader(idx))}
        </Stack>
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
                  : fmt.format(startOfWeek.hour(hour).toDate())}
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

          {range(0, 7).map((idx) => (
            <Stack
              key={`week_${idx}`}
              sx={{
                minWidth: `${DayWidth}px`,
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
                  key={`week_${idx}_hour_${hour}`}
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
                {getProgramsForDay(startOfWeek.add(idx, 'days'))}
              </Box>
            </Stack>
          ))}
        </Stack>
      </Stack>
      <ProgramDetailsDialog
        program={openProgramDetails ?? undefined}
        open={!!openProgramDetails}
        onClose={() => setOpenProgramDetails(null)}
      />
    </Stack>
  );
};
