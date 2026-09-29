import type { CondensedContentProgram } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { OneDayMillis } from '../../helpers/constants.ts';
import { restrictHours } from './useRestrictHours.ts';

const OneHourMillis = 60 * 60 * 1000;

const content = (id: string, duration: number): CondensedContentProgram => ({
  type: 'content',
  id,
  duration,
});

describe('restrictHours', () => {
  const startOffset = 7 * OneHourMillis; // 7am
  const toOffset = 19 * OneHourMillis; // 7pm
  const maxDuration = toOffset - startOffset;

  test('pads the tail so the lineup totals a whole number of days', () => {
    // 9h of content does not fill the 12h window. Without trailing flex the
    // lineup total is not a multiple of 24h, so the guide repeats it at a
    // shifted time of day (issue #2179).
    const { newStartTime, newPrograms } = restrictHours(
      [content('a', 3 * OneHourMillis), content('b', 6 * OneHourMillis)],
      startOffset,
      toOffset,
    );

    expect(newStartTime).not.toBeNull();
    const total = newPrograms.reduce((sum, p) => sum + p.duration, 0);
    expect(total % OneDayMillis).toBe(0);
  });

  test('keeps content inside the window across the whole cycle', () => {
    const programs = [
      content('a', 3 * OneHourMillis),
      content('b', 3 * OneHourMillis),
      content('c', 3 * OneHourMillis),
      content('d', 3 * OneHourMillis),
      content('e', 3 * OneHourMillis),
      content('f', 3 * OneHourMillis),
    ];

    const { newPrograms } = restrictHours(programs, startOffset, toOffset);

    let offset = 0;
    for (const program of newPrograms) {
      if (program.type === 'content') {
        expect(offset % OneDayMillis).toBeLessThan(maxDuration);
      }
      offset += program.duration;
    }
    expect(offset % OneDayMillis).toBe(0);
  });

  test('bridges to the next window with flex when a program does not fit', () => {
    const { newPrograms } = restrictHours(
      [content('a', 11 * OneHourMillis), content('b', 2 * OneHourMillis)],
      startOffset,
      toOffset,
    );

    expect(newPrograms.map((p) => p.type)).toEqual([
      'content',
      'flex',
      'content',
      'flex',
    ]);
  });

  test('drops programs longer than the window', () => {
    const { newPrograms } = restrictHours(
      [content('a', 13 * OneHourMillis), content('b', OneHourMillis)],
      startOffset,
      toOffset,
    );

    expect(newPrograms.map((p) => p.type)).toEqual(['content', 'flex']);
  });

  test('leaves the lineup unchanged when no program fits', () => {
    const programs = [content('a', 13 * OneHourMillis)];
    const { newStartTime, newPrograms } = restrictHours(
      programs,
      startOffset,
      toOffset,
    );

    expect(newStartTime).toBeNull();
    expect(newPrograms).toBe(programs);
  });
});
