import type { RandomSlotSchedule, TimeSlot } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';
import {
  fixtureRandomSlotSchedule,
  fixtureSlotId,
  fixtureTimeSlotSchedule,
} from '../../testing/fakes/slotScheduleFixtures.ts';
import type { SlotIteratorState } from './slotIteratorState.ts';
import { remapIteratorState } from './slotIteratorRemap.ts';

const oneHour = 60 * 60 * 1000;

function show(
  showId: string,
  order: 'next' | 'shuffle',
  startHour: number,
  overrides: Partial<Extract<TimeSlot, { type: 'show' }>> = {},
): TimeSlot {
  return {
    id: fixtureSlotId(startHour + 1),
    startTime: startHour * oneHour,
    type: 'show',
    showId,
    order,
    direction: 'asc',
    seasonFilter: [],
    seasonExcludeFilter: [],
    ...overrides,
  };
}

const schedule = (...slots: TimeSlot[]) => fixtureTimeSlotSchedule({ slots });

const ordered = (lastProgramId: string) =>
  ({ type: 'ordered', lastProgramId }) as const;
const shuffled = (...playedIds: string[]) =>
  ({ type: 'shuffle', playedIds }) as const;

describe('remapIteratorState', () => {
  test('a moved or retimed slot keeps its place', () => {
    const before = schedule(show('a', 'next', 0), show('b', 'shuffle', 6));
    const after = schedule(show('b', 'shuffle', 2), show('a', 'next', 9));
    const state: SlotIteratorState = {
      iterators: { 'slot:0': ordered('a-3'), 'slot:1': shuffled('b-1') },
    };

    expect(remapIteratorState(state, before, after)).toEqual({
      iterators: { 'slot:0': shuffled('b-1'), 'slot:1': ordered('a-3') },
    });
  });

  test('changing what a slot plays or how it orders starts it over', () => {
    const before = schedule(
      show('a', 'next', 0),
      show('b', 'next', 6),
      show('c', 'next', 12),
      show('d', 'next', 18),
    );
    const after = schedule(
      show('a', 'shuffle', 0),
      show('b', 'next', 6, { direction: 'desc' }),
      show('c', 'next', 12, { seasonFilter: [2] }),
      show('d', 'next', 18),
    );
    const state: SlotIteratorState = {
      iterators: {
        'slot:0': ordered('a-3'),
        'slot:1': ordered('b-3'),
        'slot:2': ordered('c-3'),
        'slot:3': ordered('d-3'),
      },
    };

    expect(remapIteratorState(state, before, after)).toEqual({
      iterators: { 'slot:3': ordered('d-3') },
    });
  });

  test('a slot that kept its key keeps its own state over a twin', () => {
    const before = schedule(
      show('a', 'next', 0),
      show('b', 'next', 6),
      show('a', 'next', 12),
    );
    // The first `a` slot is gone. The remaining twins pair up in order.
    const after = schedule(show('b', 'next', 6), show('a', 'next', 12));
    const state: SlotIteratorState = {
      iterators: {
        'slot:0': ordered('a-1'),
        'slot:1': ordered('b-5'),
        'slot:2': ordered('a-9'),
      },
    };

    expect(remapIteratorState(state, before, after)).toEqual({
      iterators: { 'slot:0': ordered('b-5'), 'slot:1': ordered('a-1') },
    });
  });

  test('linking slots into a continue group keeps the first one’s place', () => {
    const before = schedule(show('a', 'next', 0), show('a', 'next', 12));
    const after = schedule(
      show('a', 'next', 0, { iterationGroup: 'g', linkMode: 'continue' }),
      show('a', 'next', 12, { iterationGroup: 'g', linkMode: 'continue' }),
    );
    const state: SlotIteratorState = {
      iterators: { 'slot:0': ordered('a-4'), 'slot:1': ordered('a-7') },
    };

    expect(remapIteratorState(state, before, after)).toEqual({
      iterators: { 'group:g::tv_a_next': ordered('a-4') },
    });
  });

  test('link group plays and recordings follow their group', () => {
    const rerun = { iterationGroup: 'r', linkMode: 'rerun' } as const;
    const mixedContinue = {
      iterationGroup: 'm',
      linkMode: 'continue',
    } as const;
    const mixedRerun = { iterationGroup: 'm', linkMode: 'rerun' } as const;
    const before = schedule(
      show('a', 'next', 0, rerun),
      show('a', 'next', 3, rerun),
      show('b', 'shuffle', 6, mixedContinue),
      show('b', 'shuffle', 9, mixedRerun),
    );
    const after = schedule(
      show('b', 'shuffle', 1, mixedContinue),
      show('b', 'shuffle', 4, mixedRerun),
      show('a', 'next', 7, rerun),
      show('a', 'next', 10, rerun),
    );
    const state: SlotIteratorState = {
      iterators: { 'group:r': ordered('a-2'), 'group:m': shuffled('b-1') },
      rerunPlays: { 'group:r': 1 },
      periodPlays: {
        'group:m': { programIds: ['b-1'], replayCursors: [0] },
      },
    };

    expect(remapIteratorState(state, before, after)).toEqual(state);
  });

  test('random slots carry cooldowns and the sequence by slot', () => {
    const before = fixtureRandomSlotSchedule();
    const after: RandomSlotSchedule = {
      ...before,
      slots: [...before.slots].reverse(),
    };
    const state: SlotIteratorState = {
      iterators: {},
      nextSlotIndex: 1,
      slotLastPlayedMs: { '0': 100, '1': 200, '4': 500 },
    };

    expect(remapIteratorState(state, before, after)).toEqual({
      iterators: {},
      nextSlotIndex: 3,
      slotLastPlayedMs: { '4': 100, '3': 200, '0': 500 },
    });
  });
});
