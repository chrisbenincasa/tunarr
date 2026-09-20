import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  ETV_NEXT_BINARY_NAME,
  EtvNextBinaryResolver,
  matchesPinnedCommit,
  parseVersion,
  pinnedCommit,
} from './EtvNextBinaryResolver.ts';

const ENV_VAR = 'TUNARR_ERSATZTV_NEXT_PATH';

afterEach(() => {
  delete process.env[ENV_VAR];
});

describe('parseVersion', () => {
  test('reads the semver and commit out of the worker version string', () => {
    expect(parseVersion('ersatztv-channel 0.1.0-ed95077')).toEqual({
      raw: 'ersatztv-channel 0.1.0-ed95077',
      semver: '0.1.0',
      commit: 'ed95077',
    });
  });

  test('accepts a build made from a clean tag, which carries no commit', () => {
    expect(parseVersion('ersatztv-channel 1.2.3')).toEqual({
      raw: 'ersatztv-channel 1.2.3',
      semver: '1.2.3',
      commit: undefined,
    });
  });

  test('tolerates surrounding whitespace from the process pipe', () => {
    expect(parseVersion('  ersatztv-channel 0.1.0-ed95077\n')?.semver).toBe(
      '0.1.0',
    );
  });

  test('returns nothing when the output carries no version at all', () => {
    expect(parseVersion('command not found')).toBeUndefined();
    expect(parseVersion('')).toBeUndefined();
  });
});

describe('matchesPinnedCommit', () => {
  test('matches the abbreviated commit against the full pinned sha', () => {
    expect(
      matchesPinnedCommit({
        raw: '',
        semver: '0.1.0',
        commit: pinnedCommit.slice(0, 7),
      }),
    ).toBe(true);
  });

  test('rejects a worker built from a different commit', () => {
    expect(
      matchesPinnedCommit({ raw: '', semver: '0.1.0', commit: 'deadbee' }),
    ).toBe(false);
  });

  // A tagged build cannot be proven to match, and upstream ships no tags yet,
  // so this is the case that will start warning the day they cut one.
  test('cannot confirm a build that reports no commit', () => {
    expect(
      matchesPinnedCommit({ raw: '', semver: '0.1.0', commit: undefined }),
    ).toBe(false);
  });
});

describe('candidatePaths', () => {
  test('prefers the arch-suffixed name, then the bare one', () => {
    const paths = EtvNextBinaryResolver.candidatePaths('linux', 'x64');
    const cwd = process.cwd();

    expect(paths).toEqual([
      path.join(cwd, 'bin', `${ETV_NEXT_BINARY_NAME}-linux-x64`),
      path.join(cwd, `${ETV_NEXT_BINARY_NAME}-linux-x64`),
      path.join(cwd, 'bin', ETV_NEXT_BINARY_NAME),
      path.join(cwd, ETV_NEXT_BINARY_NAME),
    ]);
  });

  test('appends .exe on Windows', () => {
    const paths = EtvNextBinaryResolver.candidatePaths('win32', 'x64');

    expect(paths.every((p) => p.endsWith('.exe'))).toBe(true);
    expect(paths[0]).toContain(`${ETV_NEXT_BINARY_NAME}-win32-x64.exe`);
  });

  test('tries the env var as a full path and as a directory, ahead of cwd', () => {
    process.env[ENV_VAR] = '/opt/etv';
    const paths = EtvNextBinaryResolver.candidatePaths('linux', 'arm64');

    expect(paths[0]).toBe('/opt/etv');
    expect(paths[1]).toBe(
      path.join('/opt/etv', `${ETV_NEXT_BINARY_NAME}-linux-arm64`),
    );
    expect(paths.indexOf('/opt/etv')).toBeLessThan(
      paths.findIndex((p) => p.startsWith(process.cwd())),
    );
  });

  test('drops the env var entries when it is unset', () => {
    const paths = EtvNextBinaryResolver.candidatePaths('linux', 'x64');

    expect(paths.every((p) => p.startsWith(process.cwd()))).toBe(true);
  });
});
