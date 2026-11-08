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
