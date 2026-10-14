import { describe, expect, test } from 'vitest';
import type { Lineup } from '../derived_types/Lineup.ts';
import { LineupRepository } from './LineupRepository.ts';

const lineup = (scheduleSeed?: number[]): Lineup => ({
  version: 6,
  lastUpdated: 0,
  items: [],
  startTimeOffsets: [0],
  scheduleSeed,
});

describe('LineupRepository.applyUpdateLineupRequest scheduleSeed', () => {
  test('stores a new seed', () => {
    const data = lineup();
    LineupRepository.applyUpdateLineupRequest(
      { items: [], scheduleSeed: [4, 5] },
      data,
    );
    expect(data.scheduleSeed).toEqual([4, 5]);
  });

  test('clears the seed on null', () => {
    const data = lineup([1]);
    LineupRepository.applyUpdateLineupRequest(
      { items: [], scheduleSeed: null },
      data,
    );
    expect(data.scheduleSeed).toBeUndefined();
  });

  test('keeps the seed when the request omits it', () => {
    const data = lineup([1]);
    LineupRepository.applyUpdateLineupRequest({ items: [] }, data);
    expect(data.scheduleSeed).toEqual([1]);
  });
});

describe('LineupRepository.applyUpdateLineupRequest cycle state', () => {
  const snapshot = {
    discardCount: 12,
    iteratorState: { iterators: {} },
  };

  const rebuilding = (): Lineup => ({
    ...lineup([1]),
    rebuildEachCycle: true,
    cycles: [{ itemCount: 2, durationMs: 1000, snapshot }],
    nextCycleSnapshot: snapshot,
  });

  test('stores the toggle, the cycles and the next snapshot', () => {
    const data = lineup();
    LineupRepository.applyUpdateLineupRequest(
      {
        items: [],
        rebuildEachCycle: true,
        cycles: [{ itemCount: 3, durationMs: 500, snapshot }],
        nextCycleSnapshot: snapshot,
      },
      data,
    );

    expect(data.rebuildEachCycle).toBe(true);
    expect(data.cycles).toEqual([{ itemCount: 3, durationMs: 500, snapshot }]);
    expect(data.nextCycleSnapshot).toEqual(snapshot);
  });

  // What a manual save does: the items no longer follow from the schedule.
  test('null clears every cycle field', () => {
    const data = rebuilding();
    LineupRepository.applyUpdateLineupRequest(
      {
        items: [],
        rebuildEachCycle: null,
        cycles: null,
        nextCycleSnapshot: null,
      },
      data,
    );

    expect(data.rebuildEachCycle).toBeUndefined();
    expect(data.cycles).toBeUndefined();
    expect(data.nextCycleSnapshot).toBeUndefined();
  });

  // What the boundary service writes: it never touches the toggle.
  test('an omitted field is left alone', () => {
    const data = rebuilding();
    LineupRepository.applyUpdateLineupRequest(
      { items: [], cycles: [], nextCycleSnapshot: snapshot },
      data,
    );

    expect(data.rebuildEachCycle).toBe(true);
    expect(data.cycles).toEqual([]);
  });

  test('turning the toggle off stores false rather than clearing it', () => {
    const data = rebuilding();
    LineupRepository.applyUpdateLineupRequest(
      { items: [], rebuildEachCycle: false },
      data,
    );

    expect(data.rebuildEachCycle).toBe(false);
  });
});
