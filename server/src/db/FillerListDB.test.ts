import tmp from 'tmp-promise';
import { v4 } from 'uuid';
import { describe, expect, test } from 'vitest';
import { bootstrapTunarr } from '../bootstrap.ts';
import { setGlobalOptions } from '../globals.ts';
import { copyPreMigratedDb } from '../testing/testDbFactory.ts';
import { DBAccess } from './DBAccess.ts';
import { FillerDB } from './FillerListDB.ts';

describe('FillerDB.deleteFiller', () => {
  test('fails when program_play_history still references the filler list (#2054)', async () => {
    const dir = await tmp.dir({ unsafeCleanup: true });
    try {
      await copyPreMigratedDb(dir.path);
      setGlobalOptions({ database: dir.path, log_level: 'error', verbose: 0 });
      await bootstrapTunarr();

      const dbPath = `${dir.path}/db.db`;
      const conn = DBAccess.instance.getConnection(dbPath);
      if (!conn) {
        throw new Error('Expected a DB connection for the test');
      }

      const fillerUuid = v4();
      const programUuid = v4();
      const channelUuid = v4();

      conn.sqlite
        .prepare(
          'INSERT INTO filler_show (uuid, created_at, updated_at, name) VALUES (?, ?, ?, ?)',
        )
        .run(fillerUuid, 0, 0, 'Test Filler');

      conn.sqlite
        .prepare(
          `INSERT INTO program (uuid, duration, external_key, external_source_id, source_type, title, type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          programUuid,
          1000,
          'test-key',
          'test-source',
          'plex',
          'Test Program',
          'movie',
        );

      conn.sqlite
        .prepare(
          `INSERT INTO channel (uuid, duration, guide_minimum_duration, icon, name, number, offline, start_time, transcode_config_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          channelUuid,
          1000,
          1000,
          '{}',
          'Test Channel',
          999999,
          '{}',
          0,
          'test-transcode-config',
        );

      conn.sqlite
        .prepare(
          `INSERT INTO program_play_history (uuid, program_uuid, channel_uuid, played_at, played_duration, created_at, filler_list_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(v4(), programUuid, channelUuid, 0, 1000, 0, fillerUuid);

      const db = DBAccess.instance.db;
      const drizzle = DBAccess.instance.drizzle;
      if (!db || !drizzle) {
        throw new Error('Expected DB handles for the test');
      }
      const fillerDb = new FillerDB(db, drizzle);

      // Deleting a filler list with playback-history references fails.
      let caught: unknown;
      try {
        await fillerDb.deleteFiller(fillerUuid);
      } catch (e) {
        caught = e;
      }
      expect(caught).toBeInstanceOf(Error);
      if (caught instanceof Error) {
        expect(caught.message).toMatch(/FOREIGN KEY constraint failed/);
      }

      // The filler list is still present after the failed delete.
      const fillerCountAfterFailure = conn.sqlite
        .prepare('SELECT COUNT(*) AS count FROM filler_show WHERE uuid = ?')
        .get(fillerUuid) as { count: number };
      expect(fillerCountAfterFailure.count).toBe(1);

      // Clearing the historical references (e.g. ON DELETE SET NULL or an
      // explicit UPDATE inside the deletion transaction) unblocks the delete.
      conn.sqlite
        .prepare(
          'UPDATE program_play_history SET filler_list_id = NULL WHERE filler_list_id = ?',
        )
        .run(fillerUuid);

      await fillerDb.deleteFiller(fillerUuid);

      const fillerCountAfterClear = conn.sqlite
        .prepare('SELECT COUNT(*) AS count FROM filler_show WHERE uuid = ?')
        .get(fillerUuid) as { count: number };
      expect(fillerCountAfterClear.count).toBe(0);

      // Playback history is preserved, minus the reference to the filler.
      const historyCount = conn.sqlite
        .prepare('SELECT COUNT(*) AS count FROM program_play_history')
        .get() as { count: number };
      expect(historyCount.count).toBe(1);

      await DBAccess.instance.closeConnection(dbPath);
    } finally {
      await dir.cleanup();
    }
  });
});

describe('FillerDB content resolution', () => {
  test('content rows whose program is gone are not reported as programs', async () => {
    const dir = await tmp.dir({ unsafeCleanup: true });
    try {
      await copyPreMigratedDb(dir.path);
      setGlobalOptions({ database: dir.path, log_level: 'error', verbose: 0 });
      await bootstrapTunarr();

      const conn = DBAccess.instance.getConnection();
      if (!conn) {
        throw new Error('Expected a DB connection for the test');
      }

      const fillerUuid = v4();
      const programUuid = v4();
      const danglingProgramUuid = v4();

      conn.sqlite
        .prepare(
          'INSERT INTO filler_show (uuid, created_at, updated_at, name) VALUES (?, ?, ?, ?)',
        )
        .run(fillerUuid, 0, 0, 'Test Filler');

      conn.sqlite
        .prepare(
          `INSERT INTO program (uuid, duration, external_key, external_source_id, source_type, title, type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          programUuid,
          1000,
          'test-key',
          'test-source',
          'plex',
          'Test Program',
          'movie',
        );

      conn.sqlite
        .prepare(
          'INSERT INTO filler_show_content (filler_show_uuid, program_uuid, "index") VALUES (?, ?, ?)',
        )
        .run(fillerUuid, programUuid, 0);

      // A content row left behind by a program that no longer exists. Writes
      // like this are only possible with foreign keys off, which several
      // historical migrations did.
      conn.sqlite.pragma('foreign_keys = OFF');
      conn.sqlite
        .prepare(
          'INSERT INTO filler_show_content (filler_show_uuid, program_uuid, "index") VALUES (?, ?, ?)',
        )
        .run(fillerUuid, danglingProgramUuid, 1);
      conn.sqlite.pragma('foreign_keys = ON');

      const db = DBAccess.instance.db;
      const drizzle = DBAccess.instance.drizzle;
      if (!db || !drizzle) {
        throw new Error('Expected DB handles for the test');
      }
      const fillerDb = new FillerDB(db, drizzle);

      const programs = await fillerDb.getFillerPrograms(fillerUuid);
      expect(programs).toHaveLength(1);
      expect(programs[0]?.uuid).toBe(programUuid);

      const filler = await fillerDb.getFiller(fillerUuid);
      expect(filler?.fillerContent).toHaveLength(1);

      // contentCount only counts content that actually resolves.
      const allFillers = await fillerDb.getAllFillers();
      const thisFiller = allFillers.find((f) => f.uuid === fillerUuid);
      expect(thisFiller?.content).toHaveLength(1);

      await DBAccess.instance.closeConnection(`${dir.path}/db.db`);
    } finally {
      await dir.cleanup();
    }
  });
});
