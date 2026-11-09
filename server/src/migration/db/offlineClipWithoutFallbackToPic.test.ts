import BetterSqlite3 from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

const migrationSql = fs.readFileSync(
  path.join(
    import.meta.dirname,
    'sql',
    '0056_offline_clip_without_fallback_to_pic.sql',
  ),
  'utf-8',
);

describe('0056 offline clip without fallback to pic', () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = new BetterSqlite3(':memory:');
    db.exec(`
      CREATE TABLE channel (uuid text PRIMARY KEY, offline text NOT NULL);
      CREATE TABLE channel_fallback (channel_uuid text, program_uuid text);
    `);
  });

  function insertChannel(uuid: string, offline: string) {
    db.prepare('INSERT INTO channel VALUES (?, ?)').run(uuid, offline);
  }

  function offlineOf(uuid: string): unknown {
    const row = db
      .prepare<
        [string],
        { offline: string }
      >('SELECT offline FROM channel WHERE uuid = ?')
      .get(uuid);
    if (!row) {
      throw new Error(`Channel ${uuid} not found`);
    }
    return JSON.parse(row.offline);
  }

  test('moves clip channels without a fallback to pic and keeps their picture', () => {
    insertChannel(
      'a',
      '{"mode":"clip","picture":"/p.png","soundtrack":"/s.mp3"}',
    );

    db.exec(migrationSql);

    expect(offlineOf('a')).toEqual({
      mode: 'pic',
      picture: '/p.png',
      soundtrack: '/s.mp3',
    });
  });

  test('leaves clip channels that have a fallback alone', () => {
    insertChannel('a', '{"mode":"clip"}');
    db.prepare('INSERT INTO channel_fallback VALUES (?, ?)').run('a', 'p1');

    db.exec(migrationSql);

    expect(offlineOf('a')).toEqual({ mode: 'clip' });
  });

  test('sets pic on channels with no mode', () => {
    insertChannel('a', '{}');

    db.exec(migrationSql);

    expect(offlineOf('a')).toEqual({ mode: 'pic' });
  });

  test('leaves pic channels unchanged', () => {
    insertChannel('a', '{"mode":"pic","picture":"/p.png"}');

    db.exec(migrationSql);

    expect(offlineOf('a')).toEqual({ mode: 'pic', picture: '/p.png' });
  });
});
