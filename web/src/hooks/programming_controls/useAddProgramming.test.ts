import { describe, expect, test } from 'vitest';
import { Imported } from '../../helpers/constants.ts';
import { makeContentProgram, makeEpisode } from '../../test/programFixtures.ts';
import type { AddedMedia } from '../../types/index.ts';
import { dedupeImportedMedia } from './useAddProgramming.ts';

const imported = (id: string): AddedMedia => ({
  type: Imported,
  media: makeContentProgram(makeEpisode(), 1_800_000, id),
});

const customShowItem = (id: string): AddedMedia => ({
  type: 'custom-show',
  customShowId: 'show-1',
  program: {
    type: 'custom',
    id,
    customShowId: 'show-1',
    index: 0,
    duration: 1_800_000,
  },
});

describe('dedupeImportedMedia', () => {
  test('keeps the first copy of a program expanded from several selections', () => {
    // A show, its season and its episode all expand to episode e1.
    const items = [
      imported('e1'),
      imported('e2'),
      imported('e1'),
      imported('e1'),
    ];

    const ids = dedupeImportedMedia(items).map((item) =>
      item.type === Imported ? item.media.id : item.program.id,
    );

    expect(ids).toEqual(['e1', 'e2']);
  });

  test('keeps repeated custom show items', () => {
    const items = [customShowItem('c1'), customShowItem('c1'), imported('c1')];

    expect(dedupeImportedMedia(items)).toHaveLength(3);
  });
});
