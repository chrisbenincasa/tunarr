import { describe, expect, test } from 'vitest';
import { libvaDriverName } from './TranscodeConfig.ts';

describe('libvaDriverName', () => {
  test('returns null for system so libva picks the driver', () => {
    expect(libvaDriverName('system')).toBeNull();
  });

  test('maps ihd to the case-sensitive libva name iHD', () => {
    expect(libvaDriverName('ihd')).toBe('iHD');
  });

  test.each(['i965', 'radeonsi', 'nouveau'] as const)(
    'passes %s through unchanged',
    (driver) => {
      expect(libvaDriverName(driver)).toBe(driver);
    },
  );
});
