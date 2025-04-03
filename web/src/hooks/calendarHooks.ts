import { seq } from '@tunarr/shared/util';
import type { ChannelProgram } from '@tunarr/types';
import dayjs, { isDayjs } from 'dayjs';
import { range } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { OneDayMillis } from '../helpers/constants.ts';
import { materializedProgramListSelector } from '../store/selectors.ts';
import { useChannelSuspense } from './useChannels.ts';
import { useSuspendedStore } from './useSuspendedStore.ts';

const daysInMonthCache = new Map<`${number}_${number}`, number>();

export function getDaysInMonth(year: number, monthIndex: number) {
  const key = `${year}_${monthIndex}` as const;
  const cached = daysInMonthCache.get(key);
  if (cached) {
    return cached;
  }

  let start = dayjs().month(monthIndex).year(year).startOf('month');
  let n = 0;
  while (start.month() === monthIndex) {
    n++;
    start = start.add(1, 'day');
  }
  daysInMonthCache.set(key, n);
  return n;
}

export function daysInMonthsForYear(year: number) {
  return range(0, 12).reduce(
    (prev, month) => {
      prev[month] = getDaysInMonth(year, month);
      return prev;
    },
    {} as Record<number, number>,
  );
}

export function useDaysInMonth(djs: dayjs.Dayjs): number;
export function useDaysInMonth(year: number, month: number): number;
export function useDaysInMonth(
  year: number | dayjs.Dayjs,
  month?: number,
): number {
  month = isDayjs(year) ? year.month() : (month ?? 0);
  year = isDayjs(year) ? year.year() : year;
  return useMemo(() => daysInMonthsForYear(year)?.[month] ?? 0, [month, year]);
}

type CalendarProgramDetails = {
  // start time adjusted to be capped within the given day,
  actualStartTime: dayjs.Dayjs;
  // ms into the day
  howFarIntoDay: number;
  // duration adjusted for under/overflow
  duration: number;
  // the actual program
  program: ChannelProgram;
};

export function useGetProgramsForDayFunc(channelId: string) {
  const { data: channel } = useChannelSuspense(channelId);
  const programList = useSuspendedStore(materializedProgramListSelector);

  const offsets = useMemo(
    () => programList.map((p) => p.startTimeOffset),
    [programList],
  );

  return useCallback(
    (day: dayjs.Dayjs) => {
      let start = day.startOf('day');
      if (
        channel.startTime > +start &&
        dayjs(channel.startTime).startOf('day').isSame(start)
      ) {
        start = dayjs(channel.startTime);
      }
      const channelProgress = (+start - channel.startTime) % channel.duration;

      const targetIndex =
        offsets.length === 1
          ? 0
          : seq.binarySearchRange(offsets, channelProgress);

      if (targetIndex === null) {
        return [];
      }

      const startOfCycle = +start - channelProgress;

      const calendarPrograms: CalendarProgramDetails[] = [];

      const startOfDay = start.startOf('day');
      let t = +start;
      const end = +startOfDay.add(1, 'day').startOf('day').subtract(1);
      let idx = targetIndex;
      let isFirst = true;
      while (t <= end) {
        const program = programList[idx];

        const howFarIntoDay = t - +startOfDay;
        const actualStartTime = dayjs(startOfCycle + offsets[idx]);
        const underflow =
          isFirst && actualStartTime.isBefore(t)
            ? Math.max(0, t - +actualStartTime)
            : 0;
        const overflow = Math.max(
          0,
          howFarIntoDay + program.duration - OneDayMillis,
        );
        const duration = program.duration - overflow - underflow;

        calendarPrograms.push({
          actualStartTime,
          duration,
          howFarIntoDay: howFarIntoDay,
          program: programList[idx],
        });

        idx = (idx + 1) % programList.length;
        t += duration;
        isFirst = false;
      }

      return calendarPrograms;
    },
    [channel.duration, channel.startTime, offsets, programList],
  );
}

export function useGetProgramsForDay(
  id: string,
  day: dayjs.Dayjs,
): CalendarProgramDetails[] {
  // const { data: channel } = useChannelSuspense(id);
  // const programList = useSuspendedStore(materializedProgramListSelector);
  return useGetProgramsForDayFunc(id)(day);
}
