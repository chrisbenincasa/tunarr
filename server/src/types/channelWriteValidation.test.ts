import {
  ChannelIconSchema,
  SaveableChannelSchema,
  StrictChannelIconSchema,
  StrictWatermarkSchema,
  WatermarkSchema,
} from '@tunarr/types/schemas';
import { describe, expect, test } from 'vitest';

const watermarkBase = {
  enabled: true,
  width: 10,
  verticalMargin: 5,
  horizontalMargin: 5,
};

/**
 * These schemas are split: the lenient half is on channel *responses*, which
 * are serialized from an unvalidated JSON column, and the strict half is on
 * request bodies. The `.catch()` calls on the lenient half must stay, or a
 * legacy row becomes a hard 500 on GET /channels.
 */
describe('watermark write validation', () => {
  test.each([150, -10, 50.5, '50'])(
    'rejects the out-of-contract opacity %p on write',
    (opacity) => {
      expect(
        StrictWatermarkSchema.safeParse({ ...watermarkBase, opacity }).success,
      ).toBe(false);
    },
  );

  test.each([150, -10, 50.5, '50'])(
    'still coerces the opacity %p to 100 on read',
    (opacity) => {
      const parsed = WatermarkSchema.parse({ ...watermarkBase, opacity });
      expect(parsed.opacity).toBe(100);
    },
  );

  test('accepts a valid opacity and defaults a missing one', () => {
    expect(
      StrictWatermarkSchema.parse({ ...watermarkBase, opacity: 50 }).opacity,
    ).toBe(50);
    expect(StrictWatermarkSchema.parse(watermarkBase).opacity).toBe(100);
  });

  /**
   * An unrecognised programType became undefined, which means "no restriction",
   * so a fade rule scoped to one type silently applied to every program.
   */
  test('rejects an unrecognised fadeConfig programType on write', () => {
    const fadeConfig = [{ programType: 'movies', periodMins: 5 }];
    expect(
      StrictWatermarkSchema.safeParse({ ...watermarkBase, fadeConfig }).success,
    ).toBe(false);

    const lenient = WatermarkSchema.parse({ ...watermarkBase, fadeConfig });
    expect(lenient.fadeConfig?.[0].programType).toBeUndefined();
  });

  test('rejects a string leadingEdge on write', () => {
    const fadeConfig = [{ periodMins: 5, leadingEdge: 'false' }];
    expect(
      StrictWatermarkSchema.safeParse({ ...watermarkBase, fadeConfig }).success,
    ).toBe(false);

    const lenient = WatermarkSchema.parse({ ...watermarkBase, fadeConfig });
    expect(lenient.fadeConfig?.[0].leadingEdge).toBe(true);
  });

  test('still accepts a valid fadeConfig', () => {
    const fadeConfig = [
      { programType: 'movie', periodMins: 5, leadingEdge: false },
    ];
    const parsed = StrictWatermarkSchema.parse({
      ...watermarkBase,
      fadeConfig,
    });
    expect(parsed.fadeConfig?.[0]).toMatchObject({
      programType: 'movie',
      leadingEdge: false,
    });
  });
});

describe('channel icon write validation', () => {
  const icon = { path: 'x', width: 1, duration: 0, position: 'top-left' };

  test.each([
    ['path', null],
    ['width', -20],
    ['position', 'centre'],
  ])('rejects an invalid %s on write', (key, value) => {
    expect(
      StrictChannelIconSchema.safeParse({ ...icon, [key]: value }).success,
    ).toBe(false);
  });

  test('still coerces those same values on read', () => {
    expect(ChannelIconSchema.parse({ ...icon, path: null }).path).toBe('');
    expect(ChannelIconSchema.parse({ ...icon, width: -20 }).width).toBe(0);
    expect(
      ChannelIconSchema.parse({ ...icon, position: 'centre' }).position,
    ).toBe('bottom-right');
  });

  /**
   * The strict schema uses .default() where the lenient one uses .catch(), so
   * a *missing* field behaves identically and a partial icon is still accepted.
   */
  test('a partial icon is still accepted on write', () => {
    expect(StrictChannelIconSchema.parse({})).toEqual({
      path: '',
      width: 0,
      duration: 0,
      position: 'bottom-right',
    });
  });
});

describe('SaveableChannelSchema uses the strict variants', () => {
  const channel = {
    disableFillerOverlay: false,
    duration: 60000,
    groupTitle: 'test',
    guideMinimumDuration: 30000,
    icon: { path: '', width: 0, duration: 0, position: 'bottom-right' },
    id: '00000000-0000-0000-0000-000000000000',
    name: 'Test',
    number: 1,
    offline: { mode: 'pic' },
    startTime: 0,
    stealth: false,
    streamMode: 'hls',
    transcodeConfigId: '00000000-0000-0000-0000-000000000000',
    subtitlesEnabled: false,
  };

  test('accepts a valid channel', () => {
    expect(SaveableChannelSchema.safeParse(channel).success).toBe(true);
  });

  test('rejects a channel whose watermark opacity is out of range', () => {
    const result = SaveableChannelSchema.safeParse({
      ...channel,
      watermark: { ...watermarkBase, opacity: 150 },
    });
    expect(result.success).toBe(false);
  });

  test('rejects a channel whose icon position is misspelled', () => {
    const result = SaveableChannelSchema.safeParse({
      ...channel,
      icon: { ...channel.icon, position: 'centre' },
    });
    expect(result.success).toBe(false);
  });
});
