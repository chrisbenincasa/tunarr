import type { FlexProgram, RedirectProgram } from '@tunarr/types';
import type {
  CondensedCustomProgram,
  CondensedFillerProgram,
} from '@tunarr/types/schemas';
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

  test('converts a content program', () => {
    expect(
      condensedProgramToLineupItem({
        type: 'content',
        id: 'program-1',
        duration: 1000,
        startOffsetMs: 250,
      }),
    ).toEqual({
      type: 'content',
      id: 'program-1',
      durationMs: 1000,
      startOffsetMs: 250,
    });
  });

  test('converts a filler program', () => {
    const filler: CondensedFillerProgram = {
      type: 'filler',
      id: v4(),
      fillerListId: v4(),
      fillerType: 'pre',
      duration: 30_000,
    };

    expect(condensedProgramToLineupItem(filler)).toEqual({
      type: 'content',
      id: filler.id,
      durationMs: filler.duration,
      fillerListId: filler.fillerListId,
      fillerType: 'pre',
    });
  });

  test('converts a redirect program', () => {
    const redirect: RedirectProgram = {
      type: 'redirect',
      channel: v4(),
      channelNumber: 2,
      channelName: 'Two',
      duration: 60_000,
    };

    expect(condensedProgramToLineupItem(redirect)).toEqual({
      type: 'redirect',
      channel: redirect.channel,
      durationMs: redirect.duration,
    });
  });

  test('converts a flex program to an offline item', () => {
    const flex: FlexProgram = {
      type: 'flex',
      duration: 90_000,
      fillerConfig: { fillerListIds: [v4()] },
    };

    expect(condensedProgramToLineupItem(flex)).toEqual({
      type: 'offline',
      durationMs: flex.duration,
      fillerConfig: flex.fillerConfig,
    });
  });
});
