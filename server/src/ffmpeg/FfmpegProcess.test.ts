import type { ReadableFfmpegSettings } from '@/db/interfaces/ISettingsDB.js';
import tmp from 'tmp';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { FfmpegProcess } from './FfmpegProcess.ts';

describe('FfmpegProcess', () => {
  let tmpDir: tmp.DirResult;

  beforeEach(() => {
    tmpDir = tmp.dirSync({ unsafeCleanup: true });
  });

  afterEach(() => {
    tmpDir.removeCallback();
  });

  // Node stands in for ffmpeg so the test needs no ffmpeg binary.
  test('reports running from spawn until the process exits', async () => {
    const proc = new FfmpegProcess(
      {
        ffmpegExecutablePath: process.execPath,
        enableLogging: false,
        enableFileLogging: false,
      } as ReadableFfmpegSettings,
      'test',
      ['-e', 'setTimeout(() => {}, 100)'],
      tmpDir.name,
    );

    expect(proc.running).toBe(false);

    proc.start();
    expect(proc.running).toBe(true);

    await proc.exited;
    expect(proc.running).toBe(false);
  });
});
