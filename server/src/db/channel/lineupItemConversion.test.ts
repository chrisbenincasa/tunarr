import type { CondensedCustomProgram } from '@tunarr/types/schemas';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { condensedProgramToLineupItem } from './lineupItemConversion.ts';

describe('condensedProgramToLineupItem', () => {
  test('keeps where a custom show mid-roll segment resumes', () => {
    // A mid-roll break splits a custom show program into segments. Every
    // segment after the first resumes partway into the program.
    const segment: CondensedCustomProgram = {
      type: 'custom',
      id: v4(),
      customShowId: v4(),
      index: 0,
      duration: 10 * 60 * 1000,
      startOffsetMs: 10 * 60 * 1000,
    };

    expect(condensedProgramToLineupItem(segment)).toEqual({
      type: 'content',
      id: segment.id,
      customShowId: segment.customShowId,
      durationMs: segment.duration,
      startOffsetMs: segment.startOffsetMs,
    });
  });
});
