import { describe, expect, test } from 'vitest';
import { canSkipUnchangedProgram } from './MediaSourceScanner.ts';

describe('canSkipUnchangedProgram', () => {
  test('skips a live program whose canonical ID matches', () => {
    expect(
      canSkipUnchangedProgram({ canonicalId: 'c1', state: 'ok' }, 'c1', false),
    ).toBe(true);
  });

  test('does not skip a trashed program whose canonical ID matches', () => {
    expect(
      canSkipUnchangedProgram(
        { canonicalId: 'c1', state: 'missing' },
        'c1',
        false,
      ),
    ).toBe(false);
  });

  test('does not skip when the canonical ID changed', () => {
    expect(
      canSkipUnchangedProgram({ canonicalId: 'c1', state: 'ok' }, 'c2', false),
    ).toBe(false);
  });

  test('does not skip a forced scan', () => {
    expect(
      canSkipUnchangedProgram({ canonicalId: 'c1', state: 'ok' }, 'c1', true),
    ).toBe(false);
  });

  test('does not skip a new program', () => {
    expect(canSkipUnchangedProgram(undefined, 'c1', false)).toBe(false);
  });

  test('does not skip a stored program without a canonical ID', () => {
    expect(
      canSkipUnchangedProgram({ canonicalId: null, state: 'ok' }, null, false),
    ).toBe(false);
  });
});
