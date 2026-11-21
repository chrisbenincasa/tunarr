import type { ScheduleSkeleton } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';
import { resolveScheduleSkeleton } from './resolveScheduleSkeleton.ts';

const timeSkeleton: ScheduleSkeleton = {
  type: 'time',
  flexPreference: 'end',
  period: 'day',
  maxDays: 30,
  padMs: 1,
  latenessMs: 0,
  overflow: { type: 'duration', maxMs: 0 },
  timeZoneOffset: 0,
  slots: [
    {
      id: 'skeleton-morning',
      type: 'role',
      role: 'morning',
      startTime: 0,
      order: 'shuffle',
      direction: 'asc',
    },
    {
      id: 'skeleton-night',
      type: 'role',
      role: 'night',
      startTime: 12 * 60 * 60 * 1000,
      order: 'next',
      direction: 'asc',
    },
  ],
};

const randomSkeleton: ScheduleSkeleton = {
  type: 'random',
  flexPreference: 'end',
  maxDays: 30,
  padMs: 0,
  padStyle: 'episode',
  randomDistribution: 'uniform',
  lockWeights: false,
  slots: [
    {
      id: 'skeleton-all',
      type: 'role',
      role: 'all',
      order: 'shuffle',
      direction: 'asc',
      cooldownMs: 0,
      weight: 1,
      durationSpec: { type: 'dynamic', programCount: 1 },
    },
  ],
};

const MorningId = '7d1c0a4e-6d0a-4a51-9a53-0f3f5b8d2c11';
const NightId = '0b7a3a2f-1c4e-4b8e-8f6d-2e9c5d4a7b22';
const AllId = 'c3e8f1a0-5b2d-4c7e-9a1f-6d8b0e2c4a33';

describe('resolveScheduleSkeleton', () => {
  test('swaps each time slot role for its smart collection', () => {
    const schedule = resolveScheduleSkeleton(timeSkeleton, {
      morning: MorningId,
      night: NightId,
    });

    expect(schedule.type).toBe('time');
    expect(schedule.slots).toMatchObject([
      { type: 'smart-collection', smartCollectionId: MorningId, startTime: 0 },
      { type: 'smart-collection', smartCollectionId: NightId, order: 'next' },
    ]);
    expect(schedule.slots[0]).not.toHaveProperty('role');
  });

  test('swaps random slot roles and keeps their weights', () => {
    const schedule = resolveScheduleSkeleton(randomSkeleton, { all: AllId });

    expect(schedule.type).toBe('random');
    expect(schedule.slots).toMatchObject([
      { type: 'smart-collection', smartCollectionId: AllId, weight: 1 },
    ]);
  });

  test('gives every slot a fresh ID', () => {
    const schedule = resolveScheduleSkeleton(timeSkeleton, {
      morning: MorningId,
      night: NightId,
    });

    const ids = schedule.slots.map((slot) => slot.id);
    expect(ids).not.toContain('skeleton-morning');
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('rejects a slot that names a role with no collection', () => {
    expect(() =>
      resolveScheduleSkeleton(timeSkeleton, { morning: MorningId }),
    ).toThrow('unknown role "night"');
  });
});
