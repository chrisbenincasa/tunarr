import { ChevronLeft, ChevronRight } from '@mui/icons-material';
import { Box, Grid, IconButton, Stack, Typography } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import { usePrevious } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import 'dayjs/plugin/duration';
import 'dayjs/plugin/localeData';
import weekday from 'dayjs/plugin/weekday';
import { countBy, range } from 'lodash-es';
import pluralize from 'pluralize';
import { useCallback, useMemo, useState } from 'react';
import { useDaysInMonth } from '../../hooks/calendarHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useSuspendedStore } from '../../hooks/useSuspendedStore.ts';
import type { State } from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import type {
  UIChannelProgram,
  UIChannelProgramWithOffset,
} from '../../types/index.ts';

type SelectorBasedProgramListProps = {
  // type: 'selector';
  programListSelector?: (s: State) => UIChannelProgram[];
};

type Props = SelectorBasedProgramListProps & {
  calendarState?: CalendarState;
  onChange?: (date: CalendarState) => void;
  onSelectDay?: (day: dayjs.Dayjs) => void;
};

export type CalendarState = {
  month: number;
  year: number;
};

type CalendarProgram = {
  startTime: dayjs.Dayjs;
  program: UIChannelProgramWithOffset;
};

dayjs.extend(weekday);

export const ProgramCalendarView = ({
  calendarState: providedCalendarState,
  onChange,
  onSelectDay,
}: Props) => {
  const providedDjs = useDayjs();
  const prevCalendarDate = usePrevious(!!providedCalendarState);
  const isControlled = !!providedCalendarState;

  if (prevCalendarDate !== null && prevCalendarDate !== isControlled) {
    console.error(
      'Cannot switch between uncontrolled and controlled ProgramCalendarView.',
    );
  }

  const [internalCalendarState, setInternalCalendarState] =
    useState<CalendarState>({
      month: providedCalendarState?.month ?? providedDjs().month(),
      year: providedCalendarState?.year ?? providedDjs().year(),
    });

  const handleCalendarStateChange = useCallback(
    (incoming: CalendarState) => {
      setInternalCalendarState(incoming);
      onChange?.(incoming);
    },
    [onChange],
  );

  const calendarState = providedCalendarState ?? internalCalendarState;

  const addMonths = useCallback(
    (num: number = 1) => {
      handleCalendarStateChange({
        ...calendarState,
        month: calendarState.month + num,
      });
    },
    [calendarState, handleCalendarStateChange],
  );

  const subtractMonths = useCallback(
    (num: number = 1) => {
      addMonths(-num);
    },
    [addMonths],
  );

  const monthStart = useMemo(
    () =>
      providedDjs()
        .month(calendarState.month)
        .year(calendarState.year)
        .startOf('month'),
    [calendarState.month, calendarState.year, providedDjs],
  );

  const paddingDays = monthStart.weekday();
  const daysInMonth = useDaysInMonth(monthStart);
  const endPaddingDays = 6 - monthStart.date(daysInMonth).weekday();

  const channel = useSuspendedStore((s) => s.channelEditor.currentEntity);
  const programList = useSuspendedStore(materializedProgramListSelector);

  const localeData = useMemo(() => monthStart.localeData(), [monthStart]);

  const renderEmptyDay = (key: string) => {
    return (
      <Grid size={{ xs: 12 / 7 }} key={key} sx={{ height: '100px' }}></Grid>
    );
  };

  const channelStartMs = channel?.startTime ?? 0;
  const thisMonthProgramming = useMemo(() => {
    const offsets = programList.map((p) => p.startTimeOffset);
    const startOfMonth = dayjs()
      .month(calendarState.month)
      .year(calendarState.year)
      .startOf('month');
    const channelProgress =
      (+startOfMonth - channelStartMs) % (channel?.duration ?? 0);
    const idx =
      offsets.length === 1
        ? 0
        : seq.binarySearchRange(offsets, channelProgress);
    if (idx === null) {
      return [];
    }

    const endOfMonth = startOfMonth.add(1, 'month').subtract(1);
    const cyclesInMonth = endOfMonth.diff(startOfMonth) / channel.duration;
    console.log(cyclesInMonth);

    const programs: CalendarProgram[] = [];
    let t = +startOfMonth;
    let i = idx;
    while (t < +endOfMonth) {
      const program = programList[i];
      if (program.type !== 'flex') {
        programs.push({ startTime: dayjs(t), program });
      }
      t += program.duration;
      i = (i + 1) % programList.length;
    }

    return programs;
  }, [
    calendarState.month,
    calendarState.year,
    channel.duration,
    channelStartMs,
    programList,
  ]);

  const countByDay = useMemo(() => {
    return countBy(thisMonthProgramming, (p) => p.startTime.date());
  }, [thisMonthProgramming]);

  const renderMonthDays = () => {
    return range(0, daysInMonth).map((idx) => {
      const day = monthStart.date(idx + 1).startOf('day');
      const count = countByDay?.[day.date()] ?? 0;
      return (
        <Grid
          key={`month_day_${idx}`}
          size={{ xs: 12 / 7 }}
          sx={{ height: '100px', p: 1, cursor: 'pointer' }}
          component={Box}
          onClick={() => onSelectDay?.(day)}
        >
          <Box sx={{ width: '100%', mb: 1 }}>{idx + 1}</Box>
          <Box
            sx={{
              height: 'auto',
              borderRadius: '3px',
              p: 0.5,
              backgroundColor: (theme) =>
                count === 0
                  ? theme.palette.grey[500]
                  : theme.palette.primary.main,
              color: (theme) =>
                theme.palette.getContrastText(
                  count === 0
                    ? theme.palette.grey[500]
                    : theme.palette.primary.main,
                ),
              fontSize: (theme) => theme.typography.subtitle2.fontSize,
            }}
          >
            {count} {pluralize('program', count)}
          </Box>
        </Grid>
      );
    });
  };

  return (
    <Box>
      <Stack direction="row">
        <IconButton onClick={() => subtractMonths(1)}>
          <ChevronLeft />
        </IconButton>
        <IconButton onClick={() => addMonths(1)}>
          <ChevronRight />
        </IconButton>
        <Typography
          variant="h5"
          flex={1}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          {localeData.months()[calendarState.month]} {calendarState.year}
        </Typography>
      </Stack>
      <Grid
        container
        gridTemplateColumns="repeat(7, 1fr)"
        sx={{
          '--Grid-borderWidth': '1px',
          borderTop: 'var(--Grid-borderWidth) solid',
          borderLeft: 'var(--Grid-borderWidth) solid',
          borderColor: 'divider',
          '& > div': {
            borderRight: 'var(--Grid-borderWidth) solid',
            borderBottom: 'var(--Grid-borderWidth) solid',
            borderColor: 'divider',
          },
        }}
      >
        {localeData.weekdays().map((name) => (
          <Grid
            key={`day_header_${name}`}
            size={{ xs: 12 / 7 }}
            sx={{ textAlign: 'center' }}
          >
            {name}
          </Grid>
        ))}
        {range(0, paddingDays).map((i) => renderEmptyDay(`padding_${i}`))}
        {renderMonthDays()}
        {range(0, endPaddingDays).map((i) =>
          renderEmptyDay(`end_padding_${i}`),
        )}
      </Grid>
    </Box>
  );
};
