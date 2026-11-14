import { defaultFfmpegSettings } from '@tunarr/types';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { FfmpegProcess } from './FfmpegProcess.ts';

let logDirectory: string;

beforeAll(async () => {
  logDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-process-'));
});

afterAll(async () => {
  await fs.rm(logDirectory, { recursive: true, force: true });
});

// Node stands in for ffmpeg so the tests need no ffmpeg binary.
function makeStandIn(script: string) {
  return new FfmpegProcess(
    {
      ...defaultFfmpegSettings,
      ffmpegExecutablePath: process.execPath,
      enableLogging: false,
      enableFileLogging: false,
    },
    'test ffmpeg',
    ['-e', script],
    logDirectory,
  );
}

// Starts a stand-in and records its terminal events.
function startStandIn(script: string) {
  const proc = makeStandIn(script);

  const events: string[] = [];
  proc.on('end', () => events.push('end'));
  proc.on('error', () => events.push('error'));

  const stdout = proc.start();
  if (!stdout) {
    throw new Error('Stand-in process did not start');
  }
  stdout.resume();

  return { proc, events, stdout };
}

describe('FfmpegProcess', () => {
  test('reports running from spawn until the process exits', async () => {
    const proc = makeStandIn('setTimeout(() => {}, 100)');

    expect(proc.running).toBe(false);

    proc.start();
    expect(proc.running).toBe(true);

    await proc.exited;
    expect(proc.running).toBe(false);
  });
});

describe('FfmpegProcess terminal events', () => {
  test('unexpected 255 exit before any output emits error', async () => {
    const { proc, events } = startStandIn('process.exit(255)');

    await proc.exited;

    expect(events).toEqual(['error']);
  });

  test('unexpected 255 exit after output emits end', async () => {
    const { proc, events } = startStandIn(
      "process.stdout.write('x'); setTimeout(() => process.exit(255), 200)",
    );

    await proc.exited;

    expect(events).toEqual(['end']);
  });

  test('255 exit after kill() counts as expected and emits end', async () => {
    const { proc, events, stdout } = startStandIn(
      "process.on('SIGTERM', () => process.exit(255)); process.stdout.write('ready'); setInterval(() => {}, 1000)",
    );

    await once(stdout, 'data');
    proc.kill();
    await proc.exited;

    expect(events).toEqual(['end']);
  });

  test.each([1, 8, 254])(
    'unexpected exit with code %d emits error',
    async (code) => {
      const { proc, events } = startStandIn(`process.exit(${code})`);

      await proc.exited;

      expect(events).toEqual(['error']);
    },
  );
});
