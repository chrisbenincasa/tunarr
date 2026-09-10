import {
  StrictTimeSlotScheduleSchema,
  TimeSlotScheduleSchema,
  type TimeSlotSchedule,
} from '@tunarr/types/api';
import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';

const slot = (startTime: number) => ({
  id: randomUUID(),
  startTime,
  type: 'movie' as const,
  order: 'next' as const,
  direction: 'asc' as const,
});

const valid: TimeSlotSchedule = {
  type: 'time',
  flexPreference: 'distribute',
  latenessMs: 10 * 60 * 1000,
  maxDays: 1,
  padMs: 5 * 60 * 1000,
  period: 'day',
  timeZoneOffset: 0,
  slots: [slot(21_000_000)],
};

// Each of these makes the scheduler misbehave rather than fail.
const rejected: [string, TimeSlotSchedule][] = [
  ['startTime beyond the period', { ...valid, slots: [slot(107_400_000)] }],
  ['startTime exactly one period', { ...valid, slots: [slot(86_400_000)] }],
  [
    'fractional startTime (hangs the scheduler)',
    { ...valid, slots: [slot(1234.567)] },
  ],
  ['negative startTime', { ...valid, slots: [slot(-3_600_000)] }],
  ['padMs of zero (NaN durations)', { ...valid, padMs: 0 }],
  ['negative padMs', { ...valid, padMs: -1000 }],
  ['maxDays of zero', { ...valid, maxDays: 0 }],
  ['negative maxDays (empty schedule)', { ...valid, maxDays: -1 }],
  ['negative latenessMs', { ...valid, latenessMs: -1 }],
  ['no slots at all', { ...valid, slots: [] }],
];

describe('StrictTimeSlotScheduleSchema', () => {
  test('accepts a well-formed schedule', () => {
    expect(StrictTimeSlotScheduleSchema.safeParse(valid).success).toBe(true);
  });

  test('accepts the last representable offset in the period', () => {
    const edge = { ...valid, slots: [slot(86_399_999)] };
    expect(StrictTimeSlotScheduleSchema.safeParse(edge).success).toBe(true);
  });

  test('accepts a weekly schedule using the wider period', () => {
    const weekly = {
      ...valid,
      period: 'week' as const,
      slots: [slot(107_400_000)],
    };
    expect(StrictTimeSlotScheduleSchema.safeParse(weekly).success).toBe(true);
  });

  test.each(rejected)('rejects %s', (_label, schedule) => {
    expect(StrictTimeSlotScheduleSchema.safeParse(schedule).success).toBe(
      false,
    );
  });

  test('rejects a NaN startTime', () => {
    const nan = { ...valid, slots: [slot(Number.NaN)] };
    expect(StrictTimeSlotScheduleSchema.safeParse(nan).success).toBe(false);
    // z.number() already excludes NaN, so this one never reached the scheduler.
    expect(TimeSlotScheduleSchema.safeParse(nan).success).toBe(false);
  });

  // These are the states the permissive schema lets through today, and it must
  // keep letting them through: it also parses lineups already on disk and
  // serializes channel responses, so tightening it would make a channel holding
  // one of these values fail to load.
  test.each(rejected)(
    'permissive schema still accepts %s',
    (_label, schedule) => {
      expect(TimeSlotScheduleSchema.safeParse(schedule).success).toBe(true);
    },
  );
});
