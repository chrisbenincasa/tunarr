import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  FfmpegLogMinAgeMs,
  isFfmpegLogFile,
  pruneFfmpegLogs,
} from './PruneFfmpegLogsTask.ts';

const now = new Date('2026-11-08T12:00:00Z');
const old = now.getTime() - FfmpegLogMinAgeMs - 60_000;

let tempDirs: string[] = [];

async function makeDir() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-logs-'));
  tempDirs.push(dir);
  return dir;
}

async function writeLog(directory: string, name: string, mtimeMs: number) {
  const full = path.join(directory, name);
  await fs.writeFile(full, 'log');
  const when = new Date(mtimeMs);
  await fs.utimes(full, when, when);
}

async function listNames(directory: string) {
  return (await fs.readdir(directory)).sort();
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
  tempDirs = [];
});

describe('isFfmpegLogFile', () => {
  test.each([
    ['ffmpeg-report-concat-20261108-120000.log', true],
    ['ffmpeg-error-log-transcode-1762603200000.log', true],
    ['tunarr.log', false],
    ['tunarr.1.log', false],
    ['meilisearch.log', false],
    ['ffmpeg-report-concat.txt', false],
  ])('%s -> %s', (name, expected) => {
    expect(isFfmpegLogFile(name)).toBe(expected);
  });
});

describe('pruneFfmpegLogs', () => {
  test('keeps the newest files by mtime and deletes the rest', async () => {
    const dir = await makeDir();
    for (let i = 0; i < 60; i++) {
      await writeLog(dir, `ffmpeg-report-x-${i}.log`, old - i * 1000);
    }

    const result = await pruneFfmpegLogs(dir, 50, now);

    expect(result.deleted).toHaveLength(10);
    expect(result.failed).toEqual([]);
    const remaining = await listNames(dir);
    expect(remaining).toHaveLength(50);
    for (let i = 50; i < 60; i++) {
      expect(remaining).not.toContain(`ffmpeg-report-x-${i}.log`);
    }
  });

  test('ignores file names when ordering', async () => {
    const dir = await makeDir();
    await writeLog(dir, 'ffmpeg-report-a.log', old - 2000);
    await writeLog(dir, 'ffmpeg-report-z.log', old);

    await pruneFfmpegLogs(dir, 1, now);

    expect(await listNames(dir)).toEqual(['ffmpeg-report-z.log']);
  });

  test('report files and error logs share one cap', async () => {
    const dir = await makeDir();
    await writeLog(dir, 'ffmpeg-report-a.log', old);
    await writeLog(dir, 'ffmpeg-error-log-b-1.log', old - 1000);
    await writeLog(dir, 'ffmpeg-report-c.log', old - 2000);
    await writeLog(dir, 'ffmpeg-error-log-d-2.log', old - 3000);

    await pruneFfmpegLogs(dir, 2, now);

    expect(await listNames(dir)).toEqual([
      'ffmpeg-error-log-b-1.log',
      'ffmpeg-report-a.log',
    ]);
  });

  test('never deletes recently modified files past the cap', async () => {
    const dir = await makeDir();
    const recent = now.getTime() - FfmpegLogMinAgeMs + 60_000;
    await writeLog(dir, 'ffmpeg-report-1.log', recent);
    await writeLog(dir, 'ffmpeg-report-2.log', recent - 1000);
    await writeLog(dir, 'ffmpeg-report-3.log', recent - 2000);
    await writeLog(dir, 'ffmpeg-report-4.log', old);

    const result = await pruneFfmpegLogs(dir, 1, now);

    expect(result.deleted).toEqual(['ffmpeg-report-4.log']);
    expect(await listNames(dir)).toEqual([
      'ffmpeg-report-1.log',
      'ffmpeg-report-2.log',
      'ffmpeg-report-3.log',
    ]);
  });

  test('leaves files that are not ffmpeg logs alone', async () => {
    const dir = await makeDir();
    await writeLog(dir, 'tunarr.log', old - 10_000);
    await writeLog(dir, 'tunarr.1.log', old - 10_000);
    await writeLog(dir, 'other.log', old - 10_000);
    await writeLog(dir, 'ffmpeg-report-a.log', old);
    await writeLog(dir, 'ffmpeg-report-b.log', old - 1000);

    await pruneFfmpegLogs(dir, 1, now);

    expect(await listNames(dir)).toEqual([
      'ffmpeg-report-a.log',
      'other.log',
      'tunarr.1.log',
      'tunarr.log',
    ]);
  });

  test('continues past a file that fails to delete', async () => {
    const dir = await makeDir();
    await writeLog(dir, 'ffmpeg-report-keep.log', old);
    await writeLog(dir, 'ffmpeg-report-stuck.log', old - 1000);
    await writeLog(dir, 'ffmpeg-report-gone.log', old - 2000);

    const realRm = fs.rm;
    vi.spyOn(fs, 'rm').mockImplementation((target, opts) => {
      if (String(target).endsWith('stuck.log')) {
        return Promise.reject(new Error('EBUSY'));
      }
      return realRm(target, opts);
    });

    const result = await pruneFfmpegLogs(dir, 1, now);

    expect(result.deleted).toEqual(['ffmpeg-report-gone.log']);
    expect(result.failed.map((f) => f.name)).toEqual([
      'ffmpeg-report-stuck.log',
    ]);
    expect(await listNames(dir)).toEqual([
      'ffmpeg-report-keep.log',
      'ffmpeg-report-stuck.log',
    ]);
  });

  test('is a no-op when the directory does not exist', async () => {
    const dir = await makeDir();

    const result = await pruneFfmpegLogs(path.join(dir, 'missing'), 1, now);

    expect(result).toEqual({ deleted: [], failed: [] });
  });
});
