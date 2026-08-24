import fs from 'node:fs/promises';
import path from 'node:path';
import tmp from 'tmp-promise';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { setGlobalOptionsUnchecked } from '../globals.ts';
import { DatabaseSchemaTooNewError } from '../migration/DatabaseSchemaTooNewError.ts';
import { copyPreMigratedDb } from '../testing/testDbFactory.ts';
import { DBAccess } from './DBAccess.ts';

type Fixture = {
  dbDir: string;
};

const test = baseTest.extend<Fixture>({
  dbDir: async ({}, use) => {
    const dbResult = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dbResult.path);
    const opts = setGlobalOptionsUnchecked({
      database: dbResult.path,
      log_level: 'error',
      verbose: 0,
    });
    await bootstrapTunarr(opts);
    await use(dbResult.path);
    await DBAccess.instance.closeConnection(path.join(dbResult.path, 'db.db'));
    await dbResult.cleanup();
  },
});

function recordMigration(dbPath: string, name: string) {
  const conn = DBAccess.instance.getOrCreateConnection(dbPath);
  conn.sqlite
    .prepare('INSERT INTO migrations (name, timestamp) VALUES (?, ?)')
    .run(name, new Date().toISOString());
}

async function preMigrationSnapshots(dbDir: string) {
  const entries = await fs.readdir(dbDir);
  return entries.filter((entry) => entry.includes('-pre-migration-'));
}

describe('migrateExistingDatabase - downgrade guard', () => {
  test('refuses a database carrying migrations this build does not know', async ({
    dbDir,
  }) => {
    const dbPath = path.join(dbDir, 'db.db');
    recordMigration(dbPath, '9999_from_the_future');

    await expect(
      DBAccess.instance.migrateExistingDatabase(dbPath),
    ).rejects.toThrow(DatabaseSchemaTooNewError);
  });

  test('names the offending migration so the message is actionable', async ({
    dbDir,
  }) => {
    const dbPath = path.join(dbDir, 'db.db');
    recordMigration(dbPath, '9999_from_the_future');

    await expect(
      DBAccess.instance.migrateExistingDatabase(dbPath),
    ).rejects.toThrow(/9999_from_the_future/);
  });

  test('stays out of the way of an up to date database', async ({ dbDir }) => {
    const dbPath = path.join(dbDir, 'db.db');

    await expect(
      DBAccess.instance.migrateExistingDatabase(dbPath),
    ).resolves.toBeUndefined();
  });

  test('takes no snapshot when there is nothing to migrate', async ({
    dbDir,
  }) => {
    const dbPath = path.join(dbDir, 'db.db');

    await DBAccess.instance.migrateExistingDatabase(dbPath);

    expect(await preMigrationSnapshots(dbDir)).toHaveLength(0);
  });
});

describe('database backup rotation', () => {
  test('keeps the newest three of each backup pool', async ({ dbDir }) => {
    const plant = async (name: string) =>
      fs.writeFile(path.join(dbDir, name), 'not a real database');

    // Interleaved so an implementation that rotated one combined pool would
    // drop pre-migration snapshots that this one must keep.
    for (const stamp of [1, 2, 3, 4, 5]) {
      await plant(`db-176000000000${stamp}.bak`);
      await plant(`db-pre-migration-176000000000${stamp}.bak`);
    }

    const opts = setGlobalOptionsUnchecked({
      database: dbDir,
      log_level: 'error',
      verbose: 0,
    });
    await bootstrapTunarr(opts);

    const remaining = await fs.readdir(dbDir);
    expect(remaining.filter((e) => e.match(/^db-\d+\.bak$/))).toHaveLength(3);
    expect(await preMigrationSnapshots(dbDir)).toHaveLength(3);
    // The newest of each pool survives.
    expect(remaining).toContain('db-1760000000005.bak');
    expect(remaining).toContain('db-pre-migration-1760000000005.bak');
  });
});

describe('migrateExistingDatabase - pre-migration snapshot', () => {
  test('snapshots the database before applying a pending migration', async ({
    dbDir,
  }) => {
    const dbPath = path.join(dbDir, 'db.db');
    const conn = DBAccess.instance.getOrCreateConnection(dbPath);

    // Make the most recent migration look unapplied so there is real work to do.
    const newest = conn.sqlite
      .prepare(
        'SELECT name FROM migrations ORDER BY timestamp DESC, name DESC LIMIT 1',
      )
      .get() as { name: string };
    conn.sqlite
      .prepare('DELETE FROM migrations WHERE name = ?')
      .run(newest.name);

    try {
      await DBAccess.instance.migrateExistingDatabase(dbPath);
    } catch {
      // Re-running an already-applied migration may fail. The snapshot is taken
      // before any of that, which is the point being asserted.
    }

    expect(await preMigrationSnapshots(dbDir)).toHaveLength(1);
  });
});
