import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import {
  ETV_NEXT_BINARY_NAME,
  EtvNextBinaryNotFoundError,
  EtvNextBinaryResolver,
  EtvNextContractMismatchError,
  EtvNextVersionMismatchError,
} from './EtvNextBinaryResolver.ts';
import { pinnedEtvNextVersion } from './EtvNextVersion.ts';

const ENV_VAR = 'TUNARR_ERSATZTV_NEXT_PATH';

const exampleDescribePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'schema',
  'example-describe.json',
);

/** The pinned worker's `describe` output, with a different version or describe_version. */
async function describeOutput({
  version = `${pinnedEtvNextVersion}+linux-x64`,
  describeVersion = 1,
}: { version?: string; describeVersion?: number } = {}) {
  const raw = JSON.parse(await fs.readFile(exampleDescribePath, 'utf-8')) as {
    describe_version: number;
    binary: { version: string };
  };
  raw.describe_version = describeVersion;
  raw.binary.version = version;
  return JSON.stringify(raw);
}

type ProbeOutput = string | Error;

/** Answers `describe` and `--version` separately; an Error makes that probe fail. */
function fakeChildProcessHelper(probes: {
  describe: ProbeOutput;
  version?: ProbeOutput;
}) {
  const answer = (output: ProbeOutput | undefined) =>
    output instanceof Error || output === undefined
      ? Promise.reject(output ?? new Error('unexpected probe'))
      : Promise.resolve(output);

  return {
    getStdout: vi.fn((_path: string, args: string[]) =>
      answer(args[0] === 'describe' ? probes.describe : probes.version),
    ),
  } as unknown as ChildProcessHelper;
}

const unknownCommand = new Error('unrecognized subcommand describe');

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

describe('EtvNextBinaryNotFoundError', () => {
  test('names the tested paths and the download command', () => {
    const error = new EtvNextBinaryNotFoundError(['/a/bin', '/b/bin']);

    expect(error.message).toContain('/a/bin, /b/bin');
    expect(error.message).toContain('pnpm download-ersatztv-next');
  });
});

describe('resolveChecked', () => {
  /** A fake worker in a temp dir, found either as bundled or via the env var. */
  async function makeResolver(
    source: 'bundled' | 'env',
    probes: { describe: ProbeOutput; version?: ProbeOutput },
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

    const childProcessHelper = fakeChildProcessHelper(probes);

    return {
      resolver: new EtvNextBinaryResolver(childProcessHelper),
      childProcessHelper,
    };
  }

  test('accepts a bundled binary on the pin with a matching contract', async () => {
    const { resolver } = await makeResolver('bundled', {
      describe: await describeOutput(),
    });

    await expect(resolver.resolveChecked()).resolves.toContain(
      ETV_NEXT_BINARY_NAME,
    );
  });

  // Every session start calls this under its channel lock.
  test('runs describe once, with a timeout, and skips --version', async () => {
    const { resolver, childProcessHelper } = await makeResolver('bundled', {
      describe: await describeOutput(),
    });

    await resolver.resolveChecked();
    await resolver.resolveChecked();

    expect(childProcessHelper.getStdout).toHaveBeenCalledTimes(1);
    expect(childProcessHelper.getStdout).toHaveBeenCalledWith(
      expect.any(String),
      ['describe'],
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  test('refuses a bundled binary off the pin', async () => {
    const { resolver } = await makeResolver('bundled', {
      describe: await describeOutput({ version: '9.9.9+linux-x64' }),
    });

    await expect(resolver.resolveChecked()).rejects.toBeInstanceOf(
      EtvNextVersionMismatchError,
    );
  });

  test('refuses a bundled binary whose version cannot be read', async () => {
    const { resolver } = await makeResolver('bundled', {
      describe: unknownCommand,
      version: 'garbage',
    });

    await expect(resolver.resolveChecked()).rejects.toBeInstanceOf(
      EtvNextVersionMismatchError,
    );
  });

  test('refuses a bundled binary on the pin whose describe fails', async () => {
    const { resolver } = await makeResolver('bundled', {
      describe: new Error('timed out'),
      version: `${ETV_NEXT_BINARY_NAME} ${pinnedEtvNextVersion}+linux-x64`,
    });

    await expect(resolver.resolveChecked()).rejects.toBeInstanceOf(
      EtvNextContractMismatchError,
    );
  });

  test('reads --version when describe reports an empty version', async () => {
    const { resolver } = await makeResolver('bundled', {
      describe: await describeOutput({ version: '' }),
      version: `${ETV_NEXT_BINARY_NAME} ${pinnedEtvNextVersion}+linux-x64`,
    });

    await expect(resolver.resolveChecked()).resolves.toContain(
      ETV_NEXT_BINARY_NAME,
    );
  });

  test('refuses a contract mismatch even when the env var points at it', async () => {
    const { resolver } = await makeResolver('env', {
      describe: await describeOutput({ describeVersion: 2 }),
    });

    await expect(resolver.resolveChecked()).rejects.toThrow(
      /describe_version is 2/,
    );
  });

  test('runs a binary off the pin when the env var points at it', async () => {
    const { resolver } = await makeResolver('env', {
      describe: await describeOutput({ version: '9.9.9+local' }),
    });

    await expect(resolver.resolveChecked()).resolves.toContain(
      ETV_NEXT_BINARY_NAME,
    );
  });

  test('runs an env var binary that predates describe', async () => {
    const { resolver } = await makeResolver('env', {
      describe: unknownCommand,
      version: `${ETV_NEXT_BINARY_NAME} 0.2.4+local`,
    });

    await expect(resolver.resolveChecked()).resolves.toContain(
      ETV_NEXT_BINARY_NAME,
    );
  });
});

describe('getInstalledVersion', () => {
  async function makeResolver(probes: {
    describe: ProbeOutput;
    version?: ProbeOutput;
  }) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-resolver-'));
    await fs.writeFile(path.join(dir, ETV_NEXT_BINARY_NAME), '');
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const childProcessHelper = fakeChildProcessHelper(probes);

    return {
      resolver: new EtvNextBinaryResolver(childProcessHelper),
      childProcessHelper,
    };
  }

  test('returns undefined when the binary is missing', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'etv-resolver-'));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    const childProcessHelper = {
      getStdout: vi.fn(),
    } as unknown as ChildProcessHelper;
    const resolver = new EtvNextBinaryResolver(childProcessHelper);

    await expect(resolver.getInstalledVersion()).resolves.toBeUndefined();
    expect(childProcessHelper.getStdout).not.toHaveBeenCalled();
  });

  test('returns undefined when both probes fail', async () => {
    const { resolver } = await makeResolver({
      describe: new Error('timed out'),
      version: new Error('timed out'),
    });

    await expect(resolver.getInstalledVersion()).resolves.toBeUndefined();
  });

  test('reads the full version from describe once and caches it', async () => {
    const { resolver, childProcessHelper } = await makeResolver({
      describe: await describeOutput({ version: '0.2.5+linux-x64' }),
    });

    await expect(resolver.getInstalledVersion()).resolves.toBe(
      '0.2.5+linux-x64',
    );
    await resolver.getInstalledVersion();
    expect(childProcessHelper.getStdout).toHaveBeenCalledTimes(1);
  });

  test('falls back to --version when describe reports an empty version', async () => {
    const { resolver } = await makeResolver({
      describe: await describeOutput({ version: '' }),
      version: `${ETV_NEXT_BINARY_NAME} 0.2.5+linux-x64`,
    });

    await expect(resolver.getInstalledVersion()).resolves.toBe(
      '0.2.5+linux-x64',
    );
  });

  test('falls back to --version for a worker without describe', async () => {
    const { resolver } = await makeResolver({
      describe: unknownCommand,
      version: `${ETV_NEXT_BINARY_NAME} 0.2.0-96aa6cb6-develop+linux-x64`,
    });

    await expect(resolver.getInstalledVersion()).resolves.toBe(
      '0.2.0-96aa6cb6-develop+linux-x64',
    );
  });
});
