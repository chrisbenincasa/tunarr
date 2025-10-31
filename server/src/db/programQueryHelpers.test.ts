import { v4 } from 'uuid';
import { getProgramGroupingUpsertFields } from './programQueryHelpers.ts';
import { ProgramGroupingUpdate } from './schema/ProgramGrouping.ts';

describe('getProgramGroupingUpsertFields', () => {
  test('should not override undefined fields on partial updates', () => {
    const update: ProgramGroupingUpdate = {
      uuid: v4(),
      summary: 'new summary',
      artistUuid: null,
      year: undefined, // Explicit so it's clear what we're testing
    };

    expect(getProgramGroupingUpsertFields(update)).toEqual([
      'excluded.summary',
      'excluded.artistUuid',
    ]);
  });
});
