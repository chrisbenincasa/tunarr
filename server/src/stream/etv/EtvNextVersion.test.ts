import { describe, expect, test } from 'vitest';
import {
  matchesPinnedEtvNextVersion,
  parseEtvNextVersion,
  pinnedEtvNextVersion,
} from './EtvNextVersion.ts';

describe('parseEtvNextVersion', () => {
  test('keeps the commit suffix of a develop build', () => {
    expect(parseEtvNextVersion('ersatztv-channel 0.1.0-570d136')).toBe(
      '0.1.0-570d136',
    );
  });

  test('reads a clean tag build', () => {
    expect(parseEtvNextVersion('ersatztv-channel 0.2.0')).toBe('0.2.0');
  });

  test('keeps a prerelease suffix', () => {
    expect(parseEtvNextVersion('ersatztv-channel 0.1.1-rc.1')).toBe(
      '0.1.1-rc.1',
    );
  });

  test('ignores surrounding whitespace', () => {
    expect(parseEtvNextVersion('  ersatztv-channel 0.1.0-570d136\n')).toBe(
      '0.1.0-570d136',
    );
  });

  test('returns nothing when the output carries no version', () => {
    expect(parseEtvNextVersion('command not found')).toBeUndefined();
    expect(parseEtvNextVersion('')).toBeUndefined();
  });
});

describe('matchesPinnedEtvNextVersion', () => {
  test('drops the leading v from assetVersion', () => {
    expect(pinnedEtvNextVersion.startsWith('v')).toBe(false);
  });

  test('accepts the pinned version', () => {
    expect(matchesPinnedEtvNextVersion(pinnedEtvNextVersion)).toBe(true);
  });

  test('rejects a build with the same semver from another commit', () => {
    const semver = pinnedEtvNextVersion.split('-')[0];

    expect(matchesPinnedEtvNextVersion(`${semver}-deadbee`)).toBe(false);
  });

  test('rejects a different version', () => {
    expect(matchesPinnedEtvNextVersion('9.9.9')).toBe(false);
  });
});
