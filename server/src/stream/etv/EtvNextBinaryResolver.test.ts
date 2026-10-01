import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import {
  ETV_NEXT_BINARY_NAME,
  EtvNextBinaryResolver,
} from './EtvNextBinaryResolver.ts';

const ENV_VAR = 'TUNARR_ERSATZTV_NEXT_PATH';

afterEach(() => {
  delete process.env[ENV_VAR];
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
