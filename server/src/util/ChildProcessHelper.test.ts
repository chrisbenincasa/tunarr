import { describe, expect, test } from 'vitest';
import { createDefaultSpawnOpts } from './ChildProcessHelper.ts';

describe('createDefaultSpawnOpts', () => {
  test('keeps additional spawn options such as cwd', () => {
    const opts = createDefaultSpawnOpts({
      name: 'meilisearch',
      additionalOpts: { cwd: '/config/tunarr' },
    });

    expect(opts.additionalOpts).toEqual({ cwd: '/config/tunarr' });
  });

  test('fills defaults when no options are given', () => {
    expect(createDefaultSpawnOpts()).toEqual({
      restartOnFailure: true,
      maxAttempts: 1,
      name: 'unknown',
      additionalOpts: undefined,
    });
  });
});
