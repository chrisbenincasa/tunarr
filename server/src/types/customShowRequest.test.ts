import { UpdateCustomShowRequestSchema } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';

describe('UpdateCustomShowRequestSchema', () => {
  test('an omitted programs field stays undefined', () => {
    const parsed = UpdateCustomShowRequestSchema.parse({
      name: 'Renamed',
      enableSync: false,
    });

    expect(parsed.programs).toBeUndefined();
  });

  test('an explicit empty list is kept', () => {
    const parsed = UpdateCustomShowRequestSchema.parse({
      programs: [],
      enableSync: false,
    });

    expect(parsed.programs).toEqual([]);
  });
});
