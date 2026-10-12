import { faker } from '@faker-js/faker';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import {
  ClearStreamDirectoriesStartupTask,
  StreamDirectoryNameRegex,
} from './ClearStreamDirectoriesStartupTask.ts';

vi.mock('@/util/logging/LoggerFactory.js', () => {
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    trace: vi.fn(),
    warn: vi.fn(),
    setBindings: vi.fn(),
  };
  return {
    LoggerFactory: {
      isInitialized: true,
      root: logger,
      child: () => logger,
    },
  };
});

const mockDatabaseDirectory = vi.hoisted(() => ({ value: '' }));
vi.mock('../../globals.ts', () => ({
  serverOptions: () => ({ databaseDirectory: mockDatabaseDirectory.value }),
}));

function makeSettingsDB(transcodeDirectory: string) {
  return {
    ffmpegSettings: () => ({ transcodeDirectory }),
  } as unknown as ISettingsDB;
}

async function exists(p: string) {
  return fs.access(p).then(
    () => true,
    () => false,
  );
}

describe('ClearStreamDirectoriesStartupTask', () => {
  let root: string;
  let streamsDir: string;
  let transcodeDir: string;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-sweep-'));
    mockDatabaseDirectory.value = root;
    streamsDir = path.join(root, 'streams');
    transcodeDir = path.join(root, 'transcode');
    await fs.mkdir(streamsDir);
    await fs.mkdir(transcodeDir);
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('removes per-instance and legacy stream directories from both bases', async () => {
    const perInstance = path.join(
      streamsDir,
      `stream_${faker.string.uuid()}_${faker.string.uuid()}`,
    );
    const legacy = path.join(transcodeDir, `stream_${faker.string.uuid()}`);
    for (const dir of [perInstance, legacy]) {
      await fs.mkdir(dir);
      await fs.writeFile(path.join(dir, 'stream.m3u8'), '');
    }

    await new ClearStreamDirectoriesStartupTask(
      makeSettingsDB(transcodeDir),
    ).getPromise();

    expect(await exists(perInstance)).toBe(false);
    expect(await exists(legacy)).toBe(false);
  });

  it('leaves other entries in the user-configured transcode directory alone', async () => {
    const userDir = path.join(transcodeDir, 'stream_recordings');
    const userFile = path.join(transcodeDir, `stream_${faker.string.uuid()}`);
    await fs.mkdir(userDir);
    await fs.writeFile(userFile, '');

    await new ClearStreamDirectoriesStartupTask(
      makeSettingsDB(transcodeDir),
    ).getPromise();

    expect(await exists(userDir)).toBe(true);
    expect(await exists(userFile)).toBe(true);
  });

  it('tolerates a missing base directory', async () => {
    await expect(
      new ClearStreamDirectoriesStartupTask(
        makeSettingsDB(path.join(root, 'missing')),
      ).getPromise(),
    ).resolves.toBeUndefined();
  });

  it('matches only stream_<uuid> and stream_<uuid>_<uuid>', () => {
    const a = faker.string.uuid();
    const b = faker.string.uuid();
    expect(StreamDirectoryNameRegex.test(`stream_${a}`)).toBe(true);
    expect(StreamDirectoryNameRegex.test(`stream_${a}_${b}`)).toBe(true);
    expect(StreamDirectoryNameRegex.test(`stream_${a}_extra`)).toBe(false);
    expect(StreamDirectoryNameRegex.test('stream_backup')).toBe(false);
    expect(StreamDirectoryNameRegex.test(`streams_${a}`)).toBe(false);
  });
});
