import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test, vi } from 'vitest';
import type { ChildProcessHelper } from '../../util/ChildProcessHelper.ts';
import type { EtvNextBinaryResolver } from './EtvNextBinaryResolver.ts';
import { ChannelConfigVersion } from './EtvNextChannelConfigMapper.ts';
import {
  EtvNextHardwareProbe,
  ProbeCacheTtlMs,
} from './EtvNextHardwareProbe.ts';
import type { RuntimeCapability } from './generated/describe.ts';

const exampleDescribePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'schema',
  'example-describe.json',
);

const runtime: RuntimeCapability = {
  ffmpeg: { path: '/usr/bin/ffmpeg', version: '8.1.2-etv.8', hwaccels: [] },
  accels: [],
};

/** The pinned worker's describe output with a runtime section added. */
async function probeOutput() {
  const raw = JSON.parse(
    await fs.readFile(exampleDescribePath, 'utf-8'),
  ) as Record<string, unknown>;
  raw.runtime_capability = runtime;
  return JSON.stringify(raw);
}

const selection = {
  accel: 'vaapi',
  videoFormat: 'hevc',
  bitDepth: 10,
  bitrateKbps: 10000,
  bufferKbps: 20000,
} as const;

function makeProbe(getStdout: ChildProcessHelper['getStdout']) {
  const childProcessHelper = {
    getStdout: vi.fn(getStdout),
  } as unknown as ChildProcessHelper & {
    getStdout: ReturnType<typeof vi.fn>;
  };
  const resolver = {
    resolveChecked: vi.fn(() => Promise.resolve('/opt/ersatztv-channel')),
  } as unknown as EtvNextBinaryResolver;

  return {
    probe: new EtvNextHardwareProbe(resolver, childProcessHelper),
    childProcessHelper,
  };
}

describe('EtvNextHardwareProbe', () => {
  test('passes ffmpeg and a versioned overlay file, then removes the file', async () => {
    const output = await probeOutput();
    let overlayPath = '';
    let overlay: unknown;
    const { probe, childProcessHelper } = makeProbe(async (_exe, args) => {
      overlayPath = args[args.length - 1] ?? '';
      overlay = JSON.parse(await fs.readFile(overlayPath, 'utf-8'));
      return output;
    });

    await expect(probe.probe(selection, '/usr/bin/ffmpeg')).resolves.toEqual(
      runtime,
    );

    expect(childProcessHelper.getStdout).toHaveBeenCalledWith(
      '/opt/ersatztv-channel',
      ['describe', '--ffmpeg', '/usr/bin/ffmpeg', '--probe', overlayPath],
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(overlay).toMatchObject({ version: ChannelConfigVersion });
    await expect(fs.stat(overlayPath)).rejects.toThrow();
  });

  test('shares one probe between callers until the cache expires', async () => {
    const output = await probeOutput();
    const { probe, childProcessHelper } = makeProbe(() =>
      Promise.resolve(output),
    );

    await Promise.all([
      probe.probe(selection, 'ffmpeg', 0),
      probe.probe(selection, 'ffmpeg', 0),
    ]);
    await probe.probe(selection, 'ffmpeg', ProbeCacheTtlMs - 1);
    expect(childProcessHelper.getStdout).toHaveBeenCalledTimes(1);

    await probe.probe(selection, 'ffmpeg', ProbeCacheTtlMs);
    expect(childProcessHelper.getStdout).toHaveBeenCalledTimes(2);
  });

  test('probes each selection and ffmpeg path separately', async () => {
    const output = await probeOutput();
    const { probe, childProcessHelper } = makeProbe(() =>
      Promise.resolve(output),
    );

    await probe.probe(selection, 'ffmpeg', 0);
    await probe.probe({ ...selection, bitDepth: 8 }, 'ffmpeg', 0);
    await probe.probe(selection, '/other/ffmpeg', 0);

    expect(childProcessHelper.getStdout).toHaveBeenCalledTimes(3);
  });

  test('returns undefined on failure and does not cache it', async () => {
    const output = await probeOutput();
    const { probe, childProcessHelper } = makeProbe(() =>
      Promise.resolve(output),
    );
    childProcessHelper.getStdout.mockRejectedValueOnce(new Error('timed out'));

    await expect(probe.probe(selection, 'ffmpeg', 0)).resolves.toBeUndefined();
    await expect(probe.probe(selection, 'ffmpeg', 0)).resolves.toEqual(runtime);
    expect(childProcessHelper.getStdout).toHaveBeenCalledTimes(2);
  });

  test('returns undefined when the worker reports no runtime section', async () => {
    const { probe } = makeProbe(() =>
      fs.readFile(exampleDescribePath, 'utf-8'),
    );

    await expect(probe.probe(selection, 'ffmpeg')).resolves.toBeUndefined();
  });
});
