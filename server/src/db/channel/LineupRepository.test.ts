import { describe, expect, test } from 'vitest';
import type { Lineup, LineupItem } from '../derived_types/Lineup.ts';
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

describe('LineupRepository.applyOnDemandRequest', () => {
  test('keeps the existing config when on-demand stays enabled', () => {
    const existing = {
      state: 'playing' as const,
      cursor: 12_345,
      lastPaused: 1_700_000_000_000,
      lastResumed: 1_700_000_001_000,
    };
    const data: Pick<Lineup, 'onDemandConfig'> = {
      onDemandConfig: { ...existing },
    };

    LineupRepository.applyOnDemandRequest({ enabled: true }, data);

    expect(data.onDemandConfig).toEqual(existing);
  });

  test('initializes the config when on-demand is enabled for the first time', () => {
    const data: Pick<Lineup, 'onDemandConfig'> = {};

    LineupRepository.applyOnDemandRequest({ enabled: true }, data);

    expect(data.onDemandConfig).toEqual({ state: 'paused', cursor: 0 });
  });

  test('stops rebuilding cycles when on-demand is enabled', () => {
    const snapshot = { discardCount: 4, iteratorState: { iterators: {} } };
    const data: Pick<
      Lineup,
      'onDemandConfig' | 'rebuildEachCycle' | 'cycles' | 'nextCycleSnapshot'
    > = {
      rebuildEachCycle: true,
      cycles: [{ itemCount: 2, durationMs: 1000, snapshot }],
      nextCycleSnapshot: snapshot,
    };

    LineupRepository.applyOnDemandRequest({ enabled: true }, data);

    expect(data.onDemandConfig).toEqual({ state: 'paused', cursor: 0 });
    expect(data.rebuildEachCycle).toBeUndefined();
    expect(data.cycles).toBeUndefined();
    expect(data.nextCycleSnapshot).toBeUndefined();
  });

  test('removes the config when on-demand is disabled', () => {
    const data: Pick<Lineup, 'onDemandConfig'> = {
      onDemandConfig: { state: 'paused', cursor: 500 },
    };

    LineupRepository.applyOnDemandRequest({ enabled: false }, data);

    expect(data.onDemandConfig).toBeUndefined();
  });

  test('leaves the config alone when the request omits on-demand', () => {
    const existing = { state: 'playing' as const, cursor: 500 };
    const data: Pick<Lineup, 'onDemandConfig'> = {
      onDemandConfig: { ...existing },
    };

    LineupRepository.applyOnDemandRequest(undefined, data);

    expect(data.onDemandConfig).toEqual(existing);
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

describe('LineupRepository.slotPoolProgramIds', () => {
  const contentItem = (id: string): LineupItem => ({
    type: 'content',
    id,
    durationMs: 1000,
  });

  test('keeps the whole pool the request picked, not just what aired', () => {
    const ids = LineupRepository.slotPoolProgramIds(
      [contentItem('aired-1'), contentItem('aired-2')],
      ['aired-1', 'unaired-1', 'unaired-2'],
      new Set(['aired-1', 'aired-2', 'unaired-1', 'unaired-2']),
    );

    expect(new Set(ids)).toEqual(
      new Set(['aired-1', 'aired-2', 'unaired-1', 'unaired-2']),
    );
    expect(ids).toHaveLength(4);
  });

  test('drops requested programs that no longer exist', () => {
    const ids = LineupRepository.slotPoolProgramIds(
      [contentItem('aired-1')],
      ['aired-1', 'deleted'],
      new Set(['aired-1']),
    );

    expect(ids).toEqual(['aired-1']);
  });

  test('ignores non-content items', () => {
    const ids = LineupRepository.slotPoolProgramIds(
      [{ type: 'flex', durationMs: 1000 }, contentItem('aired-1')],
      [],
      new Set(),
    );

    expect(ids).toEqual(['aired-1']);
  });
});
