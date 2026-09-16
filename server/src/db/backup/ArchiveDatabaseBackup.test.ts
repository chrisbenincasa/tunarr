import type { FileBackupOutput } from '@tunarr/types/schemas';
import BetterSqlite3 from 'better-sqlite3';
import dayjs from 'dayjs';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dbOptions, globalOptions } from '../../globals.ts';
import type { FeatureFlagService } from '../../services/FeatureFlagService.ts';
import { FileSystemService } from '../../services/FileSystemService.ts';
import type { MeilisearchService } from '../../services/MeilisearchService.ts';
import {
  inMemorySettingsDB,
  setTestGlobalOptions,
} from '../../testing/getFakeSettingsDb.ts';
import {
  ImagesFolderName,
  SettingsJsonFilename,
} from '../../util/constants.ts';
import { ArchiveDatabaseBackup } from './ArchiveDatabaseBackup.ts';

let outputDir: string;

beforeAll(async () => {
  await setTestGlobalOptions();
  const dbDir = globalOptions().databaseDirectory;

  const db = BetterSqlite3(dbOptions().dbName);
  db.exec('CREATE TABLE t (v TEXT)');
  db.close();

  await fs.writeFile(path.join(dbDir, SettingsJsonFilename), '{}');

  // Several MB across multiple entries, so the archive is still buffering when
  // the destination fails. A tiny payload can finish before the failure lands
  // and hide the ordering bug.
  const images = path.join(dbDir, ImagesFolderName);
  await fs.mkdir(images, { recursive: true });
  const payload = Buffer.alloc(4 * 1024 * 1024, 'x');
  await fs.writeFile(path.join(images, 'a.bin'), payload);
  await fs.writeFile(path.join(images, 'b.bin'), payload);
});

beforeEach(async () => {
  outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-backup-out-'));
});

afterEach(async () => {
  vi.useRealTimers();
  await fs.rm(outputDir, { recursive: true, force: true });
});

function makeBackup() {
  return new ArchiveDatabaseBackup(
    inMemorySettingsDB(),
    globalOptions(),
    new FileSystemService(globalOptions()),
    {} as unknown as MeilisearchService,
    { get: () => false } as unknown as FeatureFlagService,
  );
}

function outputConfig(outputPath: string): FileBackupOutput {
  return {
    type: 'file',
    outputPath,
    archiveFormat: 'tar',
    maxBackups: 3,
  };
}

test('returns an error when the destination cannot be opened', async () => {
  // A regular file where the output directory should be, so opening the
  // archive beneath it fails with ENOTDIR.
  const notADirectory = path.join(outputDir, 'not-a-directory');
  await fs.writeFile(notADirectory, '');

  const result = await makeBackup().backup(outputConfig(notADirectory));

  expect(result).toEqual({ type: 'error' });
}, 15_000);

test.skipIf(!existsSync('/dev/full'))(
  'returns an error and removes the partial archive when writes fail mid-stream',
  async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-02T03:04:05'));

    // The archive opens fine, then every write fails with ENOSPC.
    const archivePath = path.join(
      outputDir,
      `tunarr-backup-${dayjs().format('YYYYMMDD_HHmmss')}.tar`,
    );
    await fs.symlink('/dev/full', archivePath);

    const result = await makeBackup().backup(outputConfig(outputDir));

    expect(result).toEqual({ type: 'error' });
    expect(await fs.readdir(outputDir)).toEqual([]);
  },
  15_000,
);
