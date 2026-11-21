import { describe, expect, test } from 'vitest';
import {
  duplicateStartTimeRoles,
  nextFreeStartTime,
  type TimeBlock,
} from './blockTimes.ts';

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const LAST_MINUTE = 23 * HOUR + 59 * MINUTE;

function block(role: string, startTime: number): TimeBlock {
  return { role, label: role, startTime };
}

describe('nextFreeStartTime', () => {
  test('starts the first block at midnight', () => {
    expect(nextFreeStartTime([])).toBe(0);
  });

  test('aims three hours after the latest block, not the last one added', () => {
    expect(
      nextFreeStartTime([block('a', 20 * HOUR), block('b', 6 * HOUR)]),
    ).toBe(23 * HOUR);
  });

  test('never reuses a taken time when clamped to the end of the day', () => {
    const blocks = [block('a', 23 * HOUR)];
    const first = nextFreeStartTime(blocks);
    expect(first).toBe(LAST_MINUTE);

    const second = nextFreeStartTime([...blocks, block('b', first)]);
    expect(second).toBe(LAST_MINUTE - MINUTE);
  });
});

describe('duplicateStartTimeRoles', () => {
  test('flags every block that shares a start time', () => {
    const blocks = [
      block('a', 6 * HOUR),
      block('b', 12 * HOUR),
      block('c', 6 * HOUR),
    ];
    expect(duplicateStartTimeRoles(blocks)).toEqual(new Set(['a', 'c']));
  });

  test('is empty when every start time is unique', () => {
    expect(
      duplicateStartTimeRoles([block('a', 0), block('b', HOUR)]).size,
    ).toBe(0);
  });
});
