import { FeatureFlagsSchema } from '@tunarr/types';
import { UpdateFeatureFlagsRequestSchema } from '@tunarr/types/api';
import { describe, expect, test } from 'vitest';

/**
 * UpdateFeatureFlagsRequestSchema is written out field by field instead of
 * being derived from FeatureFlagsSchema, because `.partial()` leaves each
 * field's `.default()` in place and so cannot express "omitted". These guard
 * the hazard that introduces: the two can drift apart.
 */
describe('UpdateFeatureFlagsRequestSchema', () => {
  const flagKeys = Object.keys(FeatureFlagsSchema.shape).sort();
  const updateKeys = Object.keys(UpdateFeatureFlagsRequestSchema.shape).sort();

  test('covers exactly the flags that exist', () => {
    expect(updateKeys).toEqual(flagKeys);
  });

  test('carries no defaults, so an omitted flag stays omitted', () => {
    // `.partial()` produces `optional` wrapping `default`, which is exactly the
    // shape that made an omitted flag arrive populated.
    const withDefaults = Object.entries(
      UpdateFeatureFlagsRequestSchema.shape,
    ).filter(([, field]) => {
      const def = field._zod.def;
      return (
        def.type === 'default' ||
        (def.type === 'optional' &&
          (def.innerType as typeof field)._zod.def.type === 'default')
      );
    });

    expect(withDefaults.map(([key]) => key)).toEqual([]);
  });

  test.each(flagKeys)('omits %s from the parsed body when not sent', (key) => {
    const parsed = UpdateFeatureFlagsRequestSchema.parse({});
    expect(key in parsed).toBe(false);
  });

  test('passes through only the flags it was given', () => {
    expect(
      UpdateFeatureFlagsRequestSchema.parse({ tonemapEnabled: true }),
    ).toEqual({ tonemapEnabled: true });
  });
});
