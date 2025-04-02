import { Box, Button, Grid2, Stack, Typography } from '@mui/material';
import dayjs from 'dayjs';
import 'dayjs/plugin/duration';
import 'dayjs/plugin/localeData';
import weekday from 'dayjs/plugin/weekday';
import { countBy, range } from 'lodash-es';
import pluralize from 'pluralize';
import { useMemo, useState } from 'react';
import { useDaysInMonth } from '../../hooks/calendarHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useSuspendedStore } from '../../hooks/useSuspendedStore.ts';
import type { State } from '../../store/index.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import type { UIChannelProgram } from '../../types/index.ts';

type SelectorBasedProgramListProps = {
  // type: 'selector';
  programListSelector?: (s: State) => UIChannelProgram[];
};

type Props = SelectorBasedProgramListProps & {
  month?: number;
  year?: number;
};

type CalendarState = {
  month: number;
  year: number;
};

dayjs.extend(weekday);

export const ProgramCalendarView = ({ month, year }: Props) => {
  const providedDjs = useDayjs();
  const [calendarState, setCalendarState] = useState<CalendarState>({
    month: month ?? providedDjs().month(),
    year: year ?? providedDjs().year(),
  });

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

  const channel = useStore((s) => s.channelEditor.currentEntity);
  const programList = useSuspendedStore(materializedProgramListSelector);

  const localeData = useMemo(() => monthStart.localeData(), [monthStart]);

  const renderEmptyDay = (key: string) => {
    return (
      <Grid2 size={{ xs: 12 / 7 }} key={key} sx={{ height: '100px' }}></Grid2>
    );
  };

  const channelStartMs = channel?.startTime ?? 0;
  // const channelStart = useMemo(
  //   () => providedDjs(channel?.startTime),
  //   [channel?.startTime, providedDjs],
  // );
  const thisMonthProgramming = useMemo(() => {
    return programList.filter((p) => {
      const startDt = providedDjs(channelStartMs + p.startTimeOffset);
      return (
        startDt.year() === calendarState.year &&
        startDt.month() === calendarState.month
      );
    });
  }, [
    calendarState.month,
    calendarState.year,
    channelStartMs,
    programList,
    providedDjs,
  ]);

  const countByDay = useMemo(() => {
    return countBy(thisMonthProgramming, (p) =>
      providedDjs(channelStartMs + p.startTimeOffset).date(),
    );
  }, [channelStartMs, providedDjs, thisMonthProgramming]);

  const renderMonthDays = () => {
    return range(0, daysInMonth).map((idx) => {
      const day = monthStart.date(idx + 1).startOf('day');
      // const offset = day.diff(channel?.startTime);
      const count = countByDay?.[day.date()] ?? 0;
      return (
        <Grid2
          key={`month_day_${idx}`}
          size={{ xs: 12 / 7 }}
          sx={{ height: '100px', p: 1 }}
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
        </Grid2>
      );
    });
  };

  return (
    <Box>
      <Stack direction="row">
        <Button
          onClick={() =>
            setCalendarState((prev) => ({ ...prev, month: prev.month - 1 }))
          }
        >
          Prev
        </Button>
        <Button
          onClick={() =>
            setCalendarState((prev) => ({ ...prev, month: prev.month + 1 }))
          }
        >
          Next
        </Button>
      </Stack>
      <Typography>
        {localeData.months()[calendarState.month]} {calendarState.year}
      </Typography>
      <Grid2
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
          <Grid2 key={`day_header_${name}`} size={{ xs: 12 / 7 }}>
            {name}
          </Grid2>
        ))}
        {range(0, paddingDays).map((i) => renderEmptyDay(`padding_${i}`))}
        {renderMonthDays()}
        {range(0, endPaddingDays).map((i) =>
          renderEmptyDay(`end_padding_${i}`),
        )}
      </Grid2>
    </Box>
  );
};
