import { ArrowBack, ArrowForward, ZoomIn, ZoomOut } from '@mui/icons-material';
import { Box, IconButton, Paper, Stack } from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type { ContentProgram } from '@tunarr/types';
import dayjs from 'dayjs';
import dayOfYear from 'dayjs/plugin/dayOfYear';
import 'dayjs/plugin/duration';
import 'dayjs/plugin/localeData';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import { inRange, isUndefined, range } from 'lodash-es';
import React, { useMemo, useRef, useState } from 'react';
import { getDaysInMonth } from '../../hooks/calendarHooks.ts';
import { useDayjs } from '../../hooks/useDayjs.ts';
import { useSuspendedStore } from '../../hooks/useSuspendedStore.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import ProgramDetailsDialog from '../ProgramDetailsDialog.tsx';

dayjs.extend(weekOfYear);
dayjs.extend(dayOfYear);

const OneDayMillis = dayjs.duration(1, 'day').asMilliseconds();

const DayWidth = 145;
const DefaultBlockHeight = 48;
const LeftDividerWidth = 8;

type Props = {
  year?: number;
  month?: number;
  day?: number;
};

type WeekState = {
  year: number;
  month: number;
  day: number;
};

export const ProgramWeekCalendarView = ({ year, month, day }: Props) => {
  const providedDjs = useDayjs();
  const localeData = useMemo(() => providedDjs().localeData(), [providedDjs]);
  const [weekState, setWeekState] = useState<WeekState>(() => {
    let now = providedDjs();
    if (!isUndefined(year)) {
      now = now.year(year);
    }

    if (!isUndefined(month) && inRange(month, 0, 11)) {
      now = now.month(month);
    }

    const daysInMonth = getDaysInMonth(now.year(), now.month());
    if (!isUndefined(day) && inRange(0, daysInMonth - 1)) {
      now = now.date(day);
    }

    now = now.startOf('week');

    return {
      year: now.year(),
      month: now.month(),
      day: now.date(),
    };
  });

  const [blockHeight, setBlockHeight] = useState(DefaultBlockHeight);

  const [openProgramDetails, setOpenProgramDetails] =
    useState<ContentProgram | null>(null);

  const startOfWeek = useMemo(
    () =>
      providedDjs()
        .startOf('day')
        .year(weekState.year)
        .month(weekState.month)
        .date(weekState.day),
    [providedDjs, weekState.day, weekState.month, weekState.year],
  );

  const channel = useSuspendedStore((s) => s.channelEditor.currentEntity);
  const programList = useSuspendedStore(materializedProgramListSelector);
  const calRef = useRef<HTMLDivElement | null>(null);

  const fmt = Intl.DateTimeFormat(providedDjs().locale(), {
    hour: 'numeric',
    minute: undefined,
  });

  const offsets = useMemo(
    () => programList.map((p) => p.startTimeOffset),
    [programList],
  );

  const calHeight = calRef?.current?.getBoundingClientRect().height;
  console.log(calRef, calHeight);

  const getProgramsForDay = (day: dayjs.Dayjs) => {
    const start = day.startOf('day');
    const channelProgress = (+start - channel.startTime) % channel.duration;
    const targetIndex =
      offsets.length === 1
        ? 0
        : seq.binarySearchRange(offsets, channelProgress);
    if (targetIndex === null) {
      return null;
    }

    // const startingOffset = offsets[targetIndex];
    const startOfCycle = +start - channelProgress;

    let t = +start;
    const end = start.add(1, 'day');
    let idx = targetIndex;
    const elements: React.ReactNode[] = [];
    let isFirst = true;
    while (t <= +end - 1) {
      const program = programList[idx];

      const howFarIntoDay = t - +start;

      const actualStartTime = dayjs(startOfCycle + offsets[idx]);
      const underflow = isFirst ? Math.max(0, t - +actualStartTime) : 0;
      const overflow = Math.max(
        0,
        howFarIntoDay + program.duration - OneDayMillis,
      );
      const duration = program.duration - overflow - underflow;
      const height = (duration / OneDayMillis) * 100;

      const px = (calHeight ?? 0) * (duration / OneDayMillis);
      const dataRows = Math.floor((px - 8) / 15);

      elements.push(
        <Paper
          key={t}
          sx={{
            position: 'absolute',
            top: `${(howFarIntoDay / OneDayMillis) * 100}%`,
            left: 0,
            width: '90%',
            height: `${height}%`,
            backgroundColor: 'lightgreen',
            borderRadius: '5px',
            zIndex: 100,
            border: 'thin solid',
            borderColor: 'black',
            cursor: 'pointer',
            color: 'black',
            overflow: 'hidden',
            lineHeight: 1,
            p: 0.5,
          }}
          onClick={() =>
            program.type === 'content' ? setOpenProgramDetails(program) : void 0
          }
          elevation={
            program.type === 'content' && openProgramDetails?.id === program.id
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
              {program.type === 'content' && program.subtype === 'episode' && (
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
                  {program.grandparent?.title ?? ''}
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
        </Paper>,
      );

      idx = (idx + 1) % programList.length;
      t += duration;
      isFirst = false;
    }
    return elements;
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Stack direction="row">
        <IconButton
          onClick={() =>
            setWeekState((prev) => ({ ...prev, day: prev.day - 7 }))
          }
        >
          <ArrowBack />
        </IconButton>
        <IconButton onClick={() => setBlockHeight((prev) => prev - 8)}>
          <ZoomOut />
        </IconButton>
        <IconButton onClick={() => setBlockHeight((prev) => prev + 8)}>
          <ZoomIn />
        </IconButton>
        <IconButton
          onClick={() =>
            setWeekState((prev) => ({ ...prev, day: prev.day + 7 }))
          }
        >
          <ArrowForward />
        </IconButton>
      </Stack>
      <Stack direction="row">
        <Box sx={{ width: `${blockHeight + 8}px` }}></Box>
        <Stack
          sx={{
            '--Grid-borderWidth': '1px',
            flex: 1,
          }}
          direction="row"
        >
          {range(0, 7).map((idx) => (
            <Box
              key={`week_header_${idx}`}
              sx={{ textAlign: 'center', width: '145px' }}
            >
              <Box component="span">{localeData.weekdaysShort()[idx]}</Box>
              <br />
              <Box component="span">{startOfWeek.add(idx, 'days').date()}</Box>
            </Box>
          ))}
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
            // flex: 1,
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
                width: `${DayWidth}px`,
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
    </Box>
  );
};
