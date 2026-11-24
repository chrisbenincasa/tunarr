import { defaultFfmpegSettings } from '@tunarr/types';
import dayjs from 'dayjs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { isFfmpegLogFile } from '../tasks/PruneFfmpegLogsTask.ts';
import { FfmpegProcess } from './FfmpegProcess.ts';
import {
  activeFfmpegReportFiles,
  makeFfmpegReportFileName,
} from './ffmpegReportFiles.ts';

describe('makeFfmpegReportFileName', () => {
  const when = dayjs(new Date(2026, 10, 8, 9, 5, 7));

  test('names the file after the process and start time', () => {
    const name = makeFfmpegReportFileName('Concat Stream', when);

    expect(name).toMatch(
      /^ffmpeg-report-concat-stream-20261108-090507-[0-9a-f]{8}\.log$/,
    );
    expect(isFfmpegLogFile(name)).toBe(true);
  });

  test('gives same-second runs of one process distinct names', () => {
    expect(makeFfmpegReportFileName('x', when)).not.toEqual(
      makeFfmpegReportFileName('x', when),
    );
  });
});

describe('FfmpegProcess report registration', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  // Runs node in place of ffmpeg. Node ignores FFREPORT, so this only
  // exercises the registration around the process lifetime.
  async function runFakeFfmpeg(enableFileLogging: boolean) {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-report-'));
    const proc = new FfmpegProcess(
      {
        ...defaultFfmpegSettings,
        ffmpegExecutablePath: process.execPath,
        enableFileLogging,
      },
      'Test Stream',
      ['-e', 'setTimeout(() => {}, 200)'],
      tempDir,
    );
    proc.start();
    proc.stdout?.resume();
    const during = [...activeFfmpegReportFiles];
    await proc.exited;
    return { during, after: [...activeFfmpegReportFiles] };
  }

  test('registers the report file while ffmpeg runs', async () => {
    const { during, after } = await runFakeFfmpeg(true);

    expect(during).toHaveLength(1);
    expect(during[0]).toMatch(/^ffmpeg-report-test-stream-/);
    expect(after).toEqual([]);
  });

  test('registers nothing when file logging is off', async () => {
    const { during } = await runFakeFfmpeg(false);

    expect(during).toEqual([]);
  });
});
