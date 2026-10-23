import path from 'node:path';
import tmp from 'tmp-promise';
import { test as baseTest, describe, expect } from 'vitest';
import { bootstrapTunarr } from '../../bootstrap.ts';
import { DBAccess } from '../../db/DBAccess.ts';
import { setGlobalOptionsUnchecked } from '../../globals.ts';
import { copyPreMigratedDb } from '../../testing/testDbFactory.ts';

const StudioUniqueMigration = 'migration1792761560';

type Fixture = { dbPath: string };

// Rewinds a migrated database to just before the studio unique indexes, so
// the test can seed duplicates and then run the migration for real.

const test = baseTest.extend<Fixture>({
  dbPath: async ({}, use) => {
    const dir = await tmp.dir({ unsafeCleanup: true });
    await copyPreMigratedDb(dir.path);
    await bootstrapTunarr(
      setGlobalOptionsUnchecked({
        database: dir.path,
        log_level: 'error',
        verbose: 0,
      }),
    );
    const dbPath = path.join(dir.path, 'db.db');
    const db = DBAccess.instance.getOrCreateConnection(dbPath).sqlite;
    db.exec(`
      DROP INDEX studio_name_unique_idx;
      DROP INDEX studio_program_unique_idx;
      DROP INDEX studio_grouping_unique_idx;
    `);
    db.prepare('DELETE FROM migrations WHERE name = ?').run(
      StudioUniqueMigration,
    );
    await use(dbPath);
    await DBAccess.instance.closeConnection(dbPath);
    await dir.cleanup();
  },
});

function sqlite(dbPath: string) {
  return DBAccess.instance.getOrCreateConnection(dbPath).sqlite;
}

describe('studio unique index migration', () => {
  test('merges same-name studios and drops duplicate links', async ({
    dbPath,
  }) => {
    const db = sqlite(dbPath);
    db.pragma('foreign_keys = OFF');
    const insertStudio = db.prepare(
      'INSERT INTO studio (uuid, name) VALUES (?, ?)',
    );
    insertStudio.run('s-old', 'Warner Bros.');
    insertStudio.run('s-new', 'Warner Bros.');
    insertStudio.run('s-other', 'HBO');
    const link = db.prepare(
      'INSERT INTO studio_entity (studio_id, program_id, group_id) VALUES (?, ?, ?)',
    );
    link.run('s-old', 'p1', null);
    link.run('s-new', 'p1', null);
    link.run('s-new', 'p2', null);
    link.run('s-other', 'p2', null);
    link.run('s-other', 'p2', null);
    link.run('s-new', null, 'g1');

    await DBAccess.instance.getOrCreateConnection(dbPath).runDBMigrations();

    expect(
      db.prepare('SELECT uuid, name FROM studio ORDER BY name').all(),
    ).toEqual([
      { uuid: 's-other', name: 'HBO' },
      { uuid: 's-old', name: 'Warner Bros.' },
    ]);
    expect(
      db
        .prepare(
          'SELECT studio_id, program_id, group_id FROM studio_entity ORDER BY studio_id, program_id, group_id',
        )
        .all(),
    ).toEqual([
      { studio_id: 's-old', program_id: null, group_id: 'g1' },
      { studio_id: 's-old', program_id: 'p1', group_id: null },
      { studio_id: 's-old', program_id: 'p2', group_id: null },
      { studio_id: 's-other', program_id: 'p2', group_id: null },
    ]);
    expect(() => insertStudio.run('s-dup', 'HBO')).toThrow(/UNIQUE/);
  });
});
