import { describe, expect, test } from 'vitest';
import { calculateStreamDuration } from '../stream/StreamProgramCalculator.ts';
import type {
  ContentItem,
  Lineup,
  LineupItem,
  OfflineItem,
} from './derived_types/Lineup.ts';
import {
  rebaseChannelStartTime,
  reconcileLineupDurations,
  remapLineupPosition,
} from './lineupDurationReconciler.ts';
import { calculateStartTimeOffsets } from './lineupUtil.ts';

const content = (
  id: string,
  durationMs: number,
  extra: Partial<ContentItem> = {},
): ContentItem => ({ type: 'content', id, durationMs, ...extra });

const flex = (
  durationMs: number,
  origin?: 'flex' | 'midroll',
): OfflineItem => ({
  type: 'offline',
  durationMs,
  ...(origin ? { fillerConfig: { origin } } : {}),
});

const durations = (items: LineupItem[]) => items.map((i) => i.durationMs);

const lineupOf = (items: ReadonlyArray<LineupItem>): Lineup => ({
  version: 6,
  lastUpdated: 0,
  items,
  startTimeOffsets: calculateStartTimeOffsets(items),
});

describe('reconcileLineupDurations', () => {
  test('sets whole program items to the program duration', () => {
    const result = reconcileLineupDurations(
      [content('a', 1000), content('b', 2000)],
      new Map([
        ['a', 1500],
        ['b', 2000],
      ]),
    );

    expect(durations(result.items)).toEqual([1500, 2000]);
    expect(result.changedItemCount).toBe(1);
  });

  test('leaves unknown, fallback, and zero-length programs alone', () => {
    const items = [
      content('missing', 1000),
      content('fallback', 1000, { fillerType: 'fallback' }),
      content('zero', 1000),
    ];
    const result = reconcileLineupDurations(
      items,
      new Map([
        ['fallback', 5000],
        ['zero', 0],
      ]),
    );

    expect(result.changedItemCount).toBe(0);
    expect(result.items).toEqual(items);
  });

  test('following flex absorbs a shorter program', () => {
    const result = reconcileLineupDurations(
      [content('a', 1000), flex(500), content('b', 1000)],
      new Map([['a', 800]]),
    );

    expect(durations(result.items)).toEqual([800, 700, 1000]);
  });

  test('following flex absorbs a longer program until it runs out', () => {
    const grows = reconcileLineupDurations(
      [content('a', 1000), flex(500), content('b', 1000)],
      new Map([['a', 1200]]),
    );
    expect(durations(grows.items)).toEqual([1200, 300, 1000]);

    const overflows = reconcileLineupDurations(
      [content('a', 1000), flex(500), content('b', 1000)],
      new Map([['a', 1700]]),
    );
    expect(durations(overflows.items)).toEqual([1700, 1000]);
    expect(overflows.indexMap).toEqual([
      { index: 0, kept: true },
      { index: 1, kept: false },
      { index: 1, kept: true },
    ]);
  });

  test('does not absorb into a mid-roll break', () => {
    const result = reconcileLineupDurations(
      [content('a', 1000), flex(500, 'midroll'), content('b', 1000)],
      new Map([['a', 800]]),
    );

    expect(durations(result.items)).toEqual([800, 500, 1000]);
  });

  test('extends the final mid-roll segment when the program grows', () => {
    const result = reconcileLineupDurations(
      [
        content('a', 400, { startOffsetMs: 0 }),
        flex(100, 'midroll'),
        content('filler', 50, { fillerType: 'mid' }),
        content('a', 600, { startOffsetMs: 400 }),
        content('b', 1000),
      ],
      new Map([
        ['a', 1300],
        ['filler', 50],
        ['b', 1000],
      ]),
    );

    expect(durations(result.items)).toEqual([400, 100, 50, 900, 1000]);
  });

  test('clamps and drops segments past the end of a shorter program', () => {
    const result = reconcileLineupDurations(
      [
        content('a', 400, { startOffsetMs: 0 }),
        flex(100, 'midroll'),
        content('a', 400, { startOffsetMs: 400 }),
        flex(100, 'midroll'),
        content('a', 200, { startOffsetMs: 800 }),
        content('b', 1000),
      ],
      new Map([['a', 600]]),
    );

    expect(durations(result.items)).toEqual([400, 100, 200, 1000]);
    expect(result.changedItemCount).toBe(2);
  });

  test('drops the break before each dropped segment', () => {
    const result = reconcileLineupDurations(
      [
        content('a', 400, { startOffsetMs: 0 }),
        flex(100, 'midroll'),
        content('a', 400, { startOffsetMs: 400 }),
        flex(100, 'midroll'),
        content('a', 400, { startOffsetMs: 800 }),
        content('b', 1000),
      ],
      new Map([['a', 350]]),
    );

    expect(durations(result.items)).toEqual([350, 1000]);
    expect(result.indexMap).toEqual([
      { index: 0, kept: true },
      { index: 1, kept: false },
      { index: 1, kept: false },
      { index: 1, kept: false },
      { index: 1, kept: false },
      { index: 1, kept: true },
    ]);
  });

  test('drops mid-roll filler along with the break', () => {
    const result = reconcileLineupDurations(
      [
        content('a', 400, { startOffsetMs: 0 }),
        content('ad', 50, { fillerType: 'mid' }),
        flex(50, 'midroll'),
        content('a', 400, { startOffsetMs: 400 }),
        content('b', 1000),
      ],
      new Map([['a', 300]]),
    );

    expect(durations(result.items)).toEqual([300, 1000]);
  });

  test('lets flex after a dropped final segment absorb it', () => {
    const result = reconcileLineupDurations(
      [
        content('a', 400, { startOffsetMs: 0 }),
        flex(100, 'midroll'),
        content('a', 400, { startOffsetMs: 400 }),
        flex(200),
        content('b', 1000),
      ],
      new Map([['a', 350]]),
    );

    expect(durations(result.items)).toEqual([350, 600, 1000]);
  });

  test('treats each airing of a segmented program separately', () => {
    const result = reconcileLineupDurations(
      [
        content('a', 500, { startOffsetMs: 0 }),
        content('a', 500, { startOffsetMs: 500 }),
        content('a', 500, { startOffsetMs: 0 }),
        content('a', 500, { startOffsetMs: 500 }),
      ],
      new Map([['a', 1200]]),
    );

    expect(durations(result.items)).toEqual([500, 700, 500, 700]);
  });
});

describe('remapLineupPosition', () => {
  test('moves a position in a dropped break to the next program', () => {
    const items = [
      content('a', 400, { startOffsetMs: 0 }),
      flex(100, 'midroll'),
      content('a', 400, { startOffsetMs: 400 }),
      content('b', 1000),
    ];
    const result = reconcileLineupDurations(items, new Map([['a', 350]]));

    // 50 ms into the break, which is gone. b now starts at 350.
    expect(remapLineupPosition(items, result, 450)).toBe(350);
  });
  test('keeps elapsed time in the current program', () => {
    const items = [content('a', 1000), content('b', 1000), content('c', 1000)];
    const result = reconcileLineupDurations(items, new Map([['a', 600]]));

    // 250 ms into b, which now starts at 600.
    expect(remapLineupPosition(items, result, 1250)).toBe(850);
  });

  test('keeps time remaining in flex so the next program stays put', () => {
    const items = [content('a', 1000), flex(500), content('b', 1000)];
    const result = reconcileLineupDurations(items, new Map([['a', 800]]));

    // 100 ms into the flex, 400 ms left before b.
    expect(remapLineupPosition(items, result, 1100)).toBe(1100);
  });

  test('clamps a position past the new end of the current program', () => {
    const items = [content('a', 1000), content('b', 1000)];
    const result = reconcileLineupDurations(items, new Map([['a', 600]]));

    expect(remapLineupPosition(items, result, 900)).toBe(600);
  });

  test('moves to the next item when the current one is dropped', () => {
    const items = [content('a', 1000), flex(500), content('b', 1000)];
    const result = reconcileLineupDurations(items, new Map([['a', 1700]]));

    expect(remapLineupPosition(items, result, 1200)).toBe(1700);
  });
});

describe('rebaseChannelStartTime', () => {
  const minute = 60_000;
  const oldStart = 1_760_000_040_000;
  const cycle = 5_400_000;

  test('lands on the minute within 30 s of the requested position', () => {
    const now = oldStart + 10 * 3_600_000 + 12_345;
    const position = 777_777;
    const start = rebaseChannelStartTime(oldStart, cycle, now, position);

    expect(start % minute).toBe(0);
    expect(start).toBeLessThanOrEqual(now);
    expect(start).toBeGreaterThanOrEqual(oldStart);
    expect(Math.abs(((now - start) % cycle) - position)).toBeLessThanOrEqual(
      30_000,
    );
  });

  test('rounds to the nearer minute', () => {
    const now = oldStart + 10 * minute;

    // Exact starts are 8:20 and 8:50 past the old start.
    expect(rebaseChannelStartTime(oldStart, cycle, now, 100_000)).toBe(
      oldStart + 8 * minute,
    );
    expect(rebaseChannelStartTime(oldStart, cycle, now, 70_000)).toBe(
      oldStart + 9 * minute,
    );
  });

  test('never moves the start after now', () => {
    const now = oldStart + 10 * minute - 10;

    expect(rebaseChannelStartTime(oldStart, cycle, now, 0)).toBe(
      oldStart + 9 * minute,
    );
  });
});

describe('position is preserved for streaming', () => {
  test('the stream stays within 30 s of its position after a rebase', () => {
    const items = [
      content('a', 60_000),
      flex(30_000),
      content('b', 90_000),
      content('c', 45_000),
      flex(15_000),
      content('d', 120_000),
    ];
    const programDurations = new Map([
      ['a', 41_500],
      ['b', 90_000],
      ['c', 52_000],
      ['d', 100_000],
    ]);
    const oldCycle = 360_000;
    const oldStart = 1_700_000_000_000;
    // 37 full cycles plus 100 s, which is 10 s into b.
    const now = oldStart + 37 * oldCycle + 100_000;

    const before = calculateStreamDuration(
      now,
      oldStart,
      oldCycle,
      lineupOf(items),
    );
    expect(before.currentProgramIndex).toBe(2);

    const result = reconcileLineupDurations(items, programDurations);
    const newCycle = result.items.reduce((sum, i) => sum + i.durationMs, 0);
    const position = remapLineupPosition(
      items,
      result,
      (now - oldStart) % oldCycle,
    );
    const newStart = rebaseChannelStartTime(oldStart, newCycle, now, position);

    const after = calculateStreamDuration(
      now,
      newStart,
      newCycle,
      lineupOf(result.items),
    );

    const streamPosition =
      (calculateStartTimeOffsets(result.items)[after.currentProgramIndex] ??
        0) + after.timeElapsed;

    expect(newStart % 60_000).toBe(0);
    expect(Math.abs(streamPosition - position)).toBeLessThanOrEqual(30_000);
  });
});
