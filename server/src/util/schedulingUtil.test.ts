import { EverySchedule } from '@tunarr/types/schemas';
import parser from 'cron-parser';
import { range } from 'lodash-es';
import { describe, expect, test } from 'vitest';
import dayjs from './dayjs.ts';
import {
  isValidCronExpression,
  legacyRescanIntervalToSchedule,
  libraryScanScheduleToCron,
  scheduleRuleToCronString,
} from './schedulingUtil.ts';

test('should parse every schedules', () => {
  const schedule: EverySchedule = {
    type: 'every',
    offsetMs: dayjs.duration(4, 'hours').asMilliseconds(),
    increment: 1,
    unit: 'hour',
  };

  expect(scheduleRuleToCronString(schedule)).toEqual('0 4-23 * * *');
});

describe('libraryScanScheduleToCron', () => {
  test('returns null when scans are off', () => {
    expect(libraryScanScheduleToCron({ type: 'off' })).toBeNull();
  });

  test('builds an hourly interval at the chosen minute', () => {
    expect(
      libraryScanScheduleToCron({ type: 'interval', hours: 6, minute: 30 }),
    ).toBe('0 30 */6 * * *');
  });

  test('offsets an interval from midnight by the start hour', () => {
    expect(
      libraryScanScheduleToCron({
        type: 'interval',
        hours: 6,
        minute: 30,
        startHour: 3,
      }),
    ).toBe('0 30 3/6 * * *');
  });

  test('reduces a start hour past the interval to its first hour of the day', () => {
    expect(
      libraryScanScheduleToCron({
        type: 'interval',
        hours: 8,
        minute: 0,
        startHour: 21,
      }),
    ).toBe('0 0 5/8 * * *');
    expect(
      libraryScanScheduleToCron({
        type: 'interval',
        hours: 6,
        minute: 0,
        startHour: 12,
      }),
    ).toBe('0 0 */6 * * *');
  });

  test('an offset interval fires at the start hour and every interval after it', () => {
    const cron = libraryScanScheduleToCron({
      type: 'interval',
      hours: 6,
      minute: 15,
      startHour: 9,
    });
    expect(cron).not.toBeNull();

    const it = parser.parseExpression(cron ?? '', {
      currentDate: new Date(2026, 10, 21, 0, 0, 0),
    });
    const times = range(0, 5).map(() =>
      dayjs(it.next().toDate()).format('HH:mm'),
    );
    expect(times).toEqual(['03:15', '09:15', '15:15', '21:15', '03:15']);
  });

  test('builds a weekly schedule on sorted, unique days', () => {
    expect(
      libraryScanScheduleToCron({
        type: 'days',
        daysOfWeek: [5, 1, 5],
        hour: 3,
        minute: 15,
      }),
    ).toBe('0 15 3 * * 1,5');
  });

  test('uses a wildcard when every day is selected', () => {
    expect(
      libraryScanScheduleToCron({
        type: 'days',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        hour: 0,
        minute: 30,
      }),
    ).toBe('0 30 0 * * *');
  });

  test('passes a cron expression through unchanged', () => {
    expect(libraryScanScheduleToCron({ type: 'cron', cron: '0 4 * * 0' })).toBe(
      '0 4 * * 0',
    );
  });
});

describe('legacyRescanIntervalToSchedule', () => {
  test.each([1, 2, 3, 4, 6, 8, 12] as const)(
    'maps %i hours to an interval at minute 30',
    (hours) => {
      expect(legacyRescanIntervalToSchedule(hours)).toEqual({
        type: 'interval',
        hours,
        minute: 30,
      });
    },
  );

  test.each([24, 48, 168])('maps %i hours to daily at 00:30', (hours) => {
    expect(legacyRescanIntervalToSchedule(hours)).toEqual({
      type: 'days',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      hour: 0,
      minute: 30,
    });
  });

  test.each([5, 7, 23])(
    'keeps the cron that %i hours produced before',
    (hours) => {
      expect(legacyRescanIntervalToSchedule(hours)).toEqual({
        type: 'cron',
        cron: `0 30 */${hours} * * *`,
      });
    },
  );

  test.each([0, 1.5])('maps %d, which scheduled nothing, to off', (hours) => {
    expect(legacyRescanIntervalToSchedule(hours)).toEqual({ type: 'off' });
  });
});

describe('isValidCronExpression', () => {
  test.each(['0 4 * * 0', '0 30 */5 * * *', '*/15 * * * *'])(
    'accepts %j',
    (expression) => {
      expect(isValidCronExpression(expression)).toBe(true);
    },
  );

  test.each(['', '   ', 'every day', '0 30 */0 * * *', '61 * * * *'])(
    'rejects %j',
    (expression) => {
      expect(isValidCronExpression(expression)).toBe(false);
    },
  );
});
