import type { TvGuideProgram } from '@tunarr/types';
import { describe, expect, it } from 'vitest';
import {
  markReady,
  MaxRefreshDelayMs,
  nowPlayingRefreshDelayMs,
  pruneHiddenLayers,
  pushProgram,
  RefreshAfterStopMs,
  StaleRetryMs,
  visibleLayerIndex,
  type NowPlayingLayer,
} from './nowPlayingLayers.ts';

function flex(start: number, stop: number): TvGuideProgram {
  return {
    type: 'flex',
    title: 'Flex',
    start,
    stop,
    duration: stop - start,
    isPaused: false,
  };
}

const first = flex(0, 60_000);
const second = flex(60_000, 120_000);
const third = flex(120_000, 180_000);

describe('nowPlayingRefreshDelayMs', () => {
  it('waits until just after the program stops', () => {
    expect(nowPlayingRefreshDelayMs(60_000, 15_000)).toBe(
      45_000 + RefreshAfterStopMs,
    );
  });

  it('retries soon when the program already ended', () => {
    expect(nowPlayingRefreshDelayMs(60_000, 60_000)).toBe(StaleRetryMs);
    expect(nowPlayingRefreshDelayMs(60_000, 90_000)).toBe(StaleRetryMs);
  });

  it('caps long waits below the browser timer limit', () => {
    const stop = Date.UTC(2026, 10, 9);
    expect(nowPlayingRefreshDelayMs(stop, stop - 30 * 86_400_000)).toBe(
      MaxRefreshDelayMs,
    );
  });

  it('never passes a timestamp as the delay', () => {
    const now = Date.UTC(2026, 10, 9);
    expect(nowPlayingRefreshDelayMs(now + 10_000, now)).toBe(
      10_000 + RefreshAfterStopMs,
    );
  });
});

describe('pushProgram', () => {
  it('returns the same array for the same airing', () => {
    const layers: NowPlayingLayer[] = [{ program: first, ready: true }];
    expect(pushProgram(layers, flex(0, 60_000))).toBe(layers);
  });

  it('adds a new airing as an unready layer', () => {
    const layers: NowPlayingLayer[] = [{ program: first, ready: true }];
    expect(pushProgram(layers, second)).toEqual([
      { program: first, ready: true },
      { program: second, ready: false },
    ]);
  });

  it('treats a changed stop as a new airing', () => {
    const layers: NowPlayingLayer[] = [{ program: first, ready: true }];
    expect(pushProgram(layers, flex(0, 90_000))).toHaveLength(2);
  });
});

describe('visibleLayerIndex', () => {
  it('keeps the old layer on screen while the new one loads', () => {
    expect(
      visibleLayerIndex([
        { program: first, ready: true },
        { program: second, ready: false },
      ]),
    ).toBe(0);
  });

  it('shows the newest ready layer', () => {
    expect(
      visibleLayerIndex([
        { program: first, ready: true },
        { program: second, ready: true },
        { program: third, ready: false },
      ]),
    ).toBe(1);
  });

  it('shows the newest layer when none is ready', () => {
    expect(
      visibleLayerIndex([
        { program: first, ready: false },
        { program: second, ready: false },
      ]),
    ).toBe(1);
  });
});

describe('markReady and pruneHiddenLayers', () => {
  it('drops the old layer once the new one is ready', () => {
    const layers = markReady(
      [
        { program: first, ready: true },
        { program: second, ready: false },
      ],
      second,
    );
    expect(visibleLayerIndex(layers)).toBe(1);
    expect(pruneHiddenLayers(layers)).toEqual([
      { program: second, ready: true },
    ]);
  });

  it('keeps newer layers that are still loading', () => {
    const layers: NowPlayingLayer[] = [
      { program: first, ready: true },
      { program: second, ready: true },
      { program: third, ready: false },
    ];
    expect(pruneHiddenLayers(layers)).toEqual(layers.slice(1));
  });

  it('keeps the layers when the oldest is on screen', () => {
    const layers: NowPlayingLayer[] = [
      { program: first, ready: true },
      { program: second, ready: false },
    ];
    expect(pruneHiddenLayers(layers)).toBe(layers);
  });
});
