import dayjs, { isDayjs } from 'dayjs';
import { range } from 'lodash-es';
import { useMemo } from 'react';

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

// const daysInMonthsThisYear = daysInMonthsForYear(dayjs().year());

export function useDaysInMonth(djs: dayjs.Dayjs): number;
export function useDaysInMonth(year: number, month: number): number;
export function useDaysInMonth(
  year: number | dayjs.Dayjs,
  month?: number,
): number {
  year = isDayjs(year) ? year.year() : year;
  month = isDayjs(year) ? year.month() : (month ?? 0);
  return useMemo(() => daysInMonthsForYear(year)?.[month] ?? 0, [month, year]);
}
