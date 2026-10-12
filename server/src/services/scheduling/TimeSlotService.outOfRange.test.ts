import { randomUUID } from 'node:crypto';
import type { TimeSlotSchedule } from '@tunarr/types/api';
import dayjs from '@/util/dayjs.js';
import { describe, expect, test } from 'vitest';
import { createFakeProgramOrm } from '../../testing/fakes/entityCreators.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.js';
import { scheduleTimeSlots } from './TimeSlotService.ts';

const ONE_DAY = 86_400_000;
const TIME_OF_DAY = 21_000_000; // 05:50
const OUT_OF_RANGE = ONE_DAY + TIME_OF_DAY; // 107_400_000, as reported

const programs: SlotSchedulerProgram[] = Array.from({ length: 8 }, (_, i) => ({
  ...createFakeProgramOrm({
    uuid: `mv${i}`,
    title: `Movie ${i}`,
    type: 'movie',
    duration: 90 * 60 * 1000,
  }),
  parentFillerLists: [],
  parentCustomShows: [],
  parentSmartCollections: [],
}));

// The settings from the bug report.
function makeSchedule(startTime: number): TimeSlotSchedule {
  return {
    type: 'time',
    flexPreference: 'distribute',
    maxDays: 1,
    padMs: 5 * 60 * 1000,
    latenessMs: 10 * 60 * 1000,
    period: 'day',
    timeZoneOffset: 0,
    slots: [
      {
        id: randomUUID(),
        startTime,
        type: 'movie' as const,
        order: 'next' as const,
        direction: 'asc' as const,
      },
    ],
  };
}

describe('time slots with a startTime beyond the period', () => {
  const midnight = dayjs().startOf('day');

  test('does not throw when generated before the slot offset', async () => {
    await expect(
      scheduleTimeSlots(
        makeSchedule(OUT_OF_RANGE),
        programs,
        undefined,
        0,
        midnight,
      ),
    ).resolves.toBeDefined();
  });

  test('produces real programming rather than one long flex block', async () => {
    const result = await scheduleTimeSlots(
      makeSchedule(OUT_OF_RANGE),
      programs,
      undefined,
      0,
      midnight.add(7, 'hours'),
    );

    const longest = Math.max(...result.lineup.map((i) => i.duration));
    expect(longest).toBeLessThanOrEqual(ONE_DAY);
    expect(
      result.lineup.filter((i) => i.type !== 'flex').length,
    ).toBeGreaterThan(0);
  });

  test('is equivalent to the same slot expressed within the period', async () => {
    const seed = [1, 2, 3, 4];
    const [outOfRange, inRange] = await Promise.all([
      scheduleTimeSlots(
        makeSchedule(OUT_OF_RANGE),
        programs,
        seed,
        0,
        midnight.add(7, 'hours'),
      ),
      scheduleTimeSlots(
        makeSchedule(TIME_OF_DAY),
        programs,
        seed,
        0,
        midnight.add(7, 'hours'),
      ),
    ]);

    expect(outOfRange.lineup.length).toBe(inRange.lineup.length);
    expect(outOfRange.lineup.map((i) => i.duration)).toEqual(
      inRange.lineup.map((i) => i.duration),
    );
  });

  test('collapses two slots that normalize onto the same offset, keeping the first', async () => {
    // 05:50 and 29:50 are the same offset once reduced. The editor collapses
    // such a pair by keeping the first, so the scheduler must agree or what
    // airs will not match what is on screen.
    const at = (startTime: number) => ({
      id: randomUUID(),
      startTime,
      type: 'movie' as const,
      order: 'next' as const,
      direction: 'asc' as const,
    });
    const base = makeSchedule(TIME_OF_DAY);
    const collided: TimeSlotSchedule = {
      ...base,
      slots: [at(TIME_OF_DAY), at(OUT_OF_RANGE)],
    };
    const single: TimeSlotSchedule = { ...base, slots: [at(TIME_OF_DAY)] };

    const seed = [9, 8, 7];
    const start = midnight.add(7, 'hours');
    const [withCollision, withoutCollision] = await Promise.all([
      scheduleTimeSlots(collided, programs, seed, 0, start),
      scheduleTimeSlots(single, programs, seed, 0, start),
    ]);

    expect(withCollision.lineup.map((i) => i.duration)).toEqual(
      withoutCollision.lineup.map((i) => i.duration),
    );
  });
});
