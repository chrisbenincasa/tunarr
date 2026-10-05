import {
  RandomSlotScheduleSchema,
  StrictRandomSlotScheduleSchema,
  type RandomSlotSchedule,
} from '@tunarr/types/api';
import { randomUUID } from 'node:crypto';
import { describe, expect, test } from 'vitest';

type Slot = RandomSlotSchedule['slots'][number];

const movieSlot = (durationSpec: Slot['durationSpec']): Slot => ({
  id: randomUUID(),
  type: 'movie',
  order: 'next',
  direction: 'asc',
  weight: 1,
  cooldownMs: 0,
  durationSpec,
});

const valid: RandomSlotSchedule = {
  type: 'random',
  flexPreference: 'end',
  maxDays: 1,
  padMs: 60 * 1000,
  padStyle: 'slot',
  randomDistribution: 'uniform',
  lockWeights: false,
  slots: [movieSlot({ type: 'fixed', durationMs: 30 * 60 * 1000 })],
};

// Each of these makes the scheduler stall or throw rather than fail cleanly.
const rejected: [string, RandomSlotSchedule][] = [
  ['no slots at all', { ...valid, slots: [] }],
  [
    'a fixed duration of zero',
    { ...valid, slots: [movieSlot({ type: 'fixed', durationMs: 0 })] },
  ],
  [
    'a negative fixed duration',
    { ...valid, slots: [movieSlot({ type: 'fixed', durationMs: -1 })] },
  ],
  [
    'a fractional program count',
    { ...valid, slots: [movieSlot({ type: 'dynamic', programCount: 1.5 })] },
  ],
  [
    'a dynamic flex slot',
    {
      ...valid,
      slots: [
        {
          type: 'flex',
          weight: 1,
          cooldownMs: 0,
          durationSpec: { type: 'dynamic', programCount: 1 },
        },
      ],
    },
  ],
];

describe('StrictRandomSlotScheduleSchema', () => {
  test('accepts a well-formed schedule', () => {
    expect(StrictRandomSlotScheduleSchema.safeParse(valid).success).toBe(true);
  });

  test('accepts a dynamic content slot', () => {
    const dynamic = {
      ...valid,
      slots: [movieSlot({ type: 'dynamic', programCount: 3 })],
    };
    expect(StrictRandomSlotScheduleSchema.safeParse(dynamic).success).toBe(
      true,
    );
  });

  test.each(rejected)('rejects %s', (_label, schedule) => {
    expect(StrictRandomSlotScheduleSchema.safeParse(schedule).success).toBe(
      false,
    );
  });

  test('names the slot in the error', () => {
    const result = StrictRandomSlotScheduleSchema.safeParse({
      ...valid,
      slots: [
        movieSlot({ type: 'fixed', durationMs: 60_000 }),
        movieSlot({ type: 'fixed', durationMs: 0 }),
      ],
    });
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'Slot 1: fixed duration must be a positive number of milliseconds, got 0',
    ]);
  });

  test('rejects a program count of zero in both schemas', () => {
    const zero = {
      ...valid,
      slots: [movieSlot({ type: 'dynamic', programCount: 0 })],
    };
    expect(StrictRandomSlotScheduleSchema.safeParse(zero).success).toBe(false);
    expect(RandomSlotScheduleSchema.safeParse(zero).success).toBe(false);
  });

  // The permissive schema also parses lineups already on disk. Tightening it
  // would make a channel holding one of these values fail to load.
  test.each(rejected)(
    'permissive schema still accepts %s',
    (_label, schedule) => {
      expect(RandomSlotScheduleSchema.safeParse(schedule).success).toBe(true);
    },
  );
});
