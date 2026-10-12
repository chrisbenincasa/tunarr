import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type * as WorkerThreads from 'node:worker_threads';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { GlobalOptions } from '../globals.ts';

const threadState = vi.hoisted(() => ({ isMainThread: true }));

vi.mock('node:worker_threads', async (importOriginal) => ({
  ...(await importOriginal<typeof WorkerThreads>()),
  get isMainThread() {
    return threadState.isMainThread;
  },
}));

describe('SettingsDBFactory', () => {
  let dir: string;
  let settingsPath: string;
  let options: GlobalOptions;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-settings-'));
    settingsPath = path.join(dir, 'settings.json');
    options = {
      database: dir,
      databaseDirectory: dir,
      log_level: undefined,
      verbose: 0,
    };
    // The factory caches instances per path and reads isMainThread at import
    // time, so each test needs a fresh copy of the module.
    vi.resetModules();
  });

  afterEach(async () => {
    threadState.isMainThread = true;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const loadFactory = async () =>
    (await import('./SettingsDBFactory.ts')).SettingsDBFactory;

  test('writes startup state on the main thread', async () => {
    const SettingsDBFactory = await loadFactory();

    new SettingsDBFactory(options).get();

    const written = JSON.parse(await fs.readFile(settingsPath, 'utf-8')) as {
      migration: { isFreshSettings: boolean };
    };
    expect(written.migration.isFreshSettings).toBe(true);
  });

  test('does not write the settings file from a worker thread', async () => {
    const SettingsDBFactory = await loadFactory();
    new SettingsDBFactory(options).get();
    const before = await fs.readFile(settingsPath, 'utf-8');
    const beforeStat = await fs.stat(settingsPath);

    vi.resetModules();
    threadState.isMainThread = false;
    const WorkerSettingsDBFactory = await loadFactory();

    const settings = new WorkerSettingsDBFactory(options).get();

    expect(settings.systemSettings()).toBeDefined();
    expect(await fs.readFile(settingsPath, 'utf-8')).toBe(before);
    expect((await fs.stat(settingsPath)).mtimeMs).toBe(beforeStat.mtimeMs);
    expect(await fs.readdir(dir)).toEqual(['settings.json']);
  });
});
