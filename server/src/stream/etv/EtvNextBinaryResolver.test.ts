import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import {
  ETV_NEXT_BINARY_NAME,
  EtvNextBinaryResolver,
  EtvNextVersionMismatchError,
} from './EtvNextBinaryResolver.ts';
import { pinnedEtvNextVersion } from './EtvNextVersion.ts';

const ENV_VAR = 'TUNARR_ERSATZTV_NEXT_PATH';

afterEach(() => {
  delete process.env[ENV_VAR];
  vi.restoreAllMocks();
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

describe('resolveChecked', () => {
  /** A fake worker in a temp dir, found either as bundled or via the env var. */
  async function makeResolver(
    source: 'bundled' | 'env',
    versionOutput: string,
  ) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-resolver-'));
    const binary = path.join(dir, ETV_NEXT_BINARY_NAME);
    await fs.writeFile(binary, '');

    if (source === 'env') {
      process.env[ENV_VAR] = dir;
      vi.spyOn(process, 'cwd').mockReturnValue(path.join(dir, 'elsewhere'));
    } else {
      await fs.mkdir(path.join(dir, 'bin'));
      await fs.rename(binary, path.join(dir, 'bin', ETV_NEXT_BINARY_NAME));
      vi.spyOn(process, 'cwd').mockReturnValue(dir);
    }

    const childProcessHelper = {
      getStdout: vi.fn(() => Promise.resolve(versionOutput)),
    } as unknown as ChildProcessHelper;

    return new EtvNextBinaryResolver(childProcessHelper);
  }

  test('accepts a bundled binary on the pin, build target included', async () => {
    const resolver = await makeResolver(
      'bundled',
      `${ETV_NEXT_BINARY_NAME} ${pinnedEtvNextVersion}+linux-x64`,
    );

    await expect(resolver.resolveChecked()).resolves.toContain(
      ETV_NEXT_BINARY_NAME,
    );
  });

  test('refuses a bundled binary off the pin', async () => {
    const resolver = await makeResolver(
      'bundled',
      `${ETV_NEXT_BINARY_NAME} 9.9.9+linux-x64`,
    );

    await expect(resolver.resolveChecked()).rejects.toBeInstanceOf(
      EtvNextVersionMismatchError,
    );
  });

  test('refuses a bundled binary whose version cannot be read', async () => {
    const resolver = await makeResolver('bundled', 'garbage');

    await expect(resolver.resolveChecked()).rejects.toBeInstanceOf(
      EtvNextVersionMismatchError,
    );
  });

  test('runs a binary off the pin when the env var points at it', async () => {
    const resolver = await makeResolver(
      'env',
      `${ETV_NEXT_BINARY_NAME} 9.9.9+local`,
    );

    await expect(resolver.resolveChecked()).resolves.toContain(
      ETV_NEXT_BINARY_NAME,
    );
  });
});
