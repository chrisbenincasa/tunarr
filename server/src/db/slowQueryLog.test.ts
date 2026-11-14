import Sqlite from 'better-sqlite3';
import { sql as drizzleSql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { Kysely, sql as kyselySql, SqliteDialect } from 'kysely';
import { describe, expect, test } from 'vitest';
import type { SlowQuery } from './slowQueryLog.ts';
import { withSlowQueryLog } from './slowQueryLog.ts';

// advance(ms) moves a fake clock forward while SQLite runs the statement, the
// way a slow query spends real time inside the call.
function setup(thresholdMs = 500) {
  let clock = 0;
  const raw = new Sqlite(':memory:');
  raw.function('advance', (ms: number) => {
    clock += ms;
    return ms;
  });

  const reports: SlowQuery[] = [];
  const db = withSlowQueryLog(raw, {
    thresholdMs,
    onSlowQuery: (query) => reports.push(query),
    now: () => clock,
  });
  return { db, reports };
}

describe('withSlowQueryLog', () => {
  test('reports a query that reaches the threshold, with its caller', () => {
    const { db, reports } = setup();

    function runSlowQuery() {
      return db.prepare('SELECT advance(600) AS ms').get();
    }

    expect(runSlowQuery()).toEqual({ ms: 600 });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      sql: 'SELECT advance(600) AS ms',
      durationMs: 600,
    });
    expect(reports[0]?.callStack[0]).toContain('runSlowQuery');
  });

  test('ignores a query under the threshold', () => {
    const { db, reports } = setup();

    db.prepare('SELECT advance(499)').all();

    expect(reports).toEqual([]);
  });

  test('times run, get, and all', () => {
    const { db, reports } = setup();
    db.exec('CREATE TABLE t (n INTEGER)');

    db.prepare('INSERT INTO t VALUES (advance(700))').run();
    db.prepare('SELECT advance(800) FROM t').get();
    db.prepare('SELECT advance(900) FROM t').all();

    expect(reports.map((r) => r.durationMs)).toEqual([700, 800, 900]);
  });

  test('keeps timing after raw() and pluck()', () => {
    const { db, reports } = setup();

    expect(db.prepare('SELECT advance(600)').raw().all()).toEqual([[600]]);
    expect(db.prepare('SELECT advance(700)').pluck().get()).toBe(700);

    expect(reports.map((r) => r.durationMs)).toEqual([600, 700]);
  });

  test('times an iteration the consumer stops early, and closes it', () => {
    const { db, reports } = setup();

    const seen: unknown[] = [];
    for (const row of db
      .prepare('SELECT advance(300) AS ms FROM (VALUES (1), (2), (3))')
      .iterate()) {
      seen.push(row);
      if (seen.length === 2) {
        break;
      }
    }

    expect(seen).toHaveLength(2);
    expect(reports.map((r) => r.durationMs)).toEqual([600]);
    // An open iterator would leave the connection busy.
    expect(db.prepare('SELECT 1 AS one').get()).toEqual({ one: 1 });
  });

  test('times exec and returns the wrapped connection', () => {
    const { db, reports } = setup();

    const result = db.exec('SELECT advance(600)');

    expect(result).toBe(db);
    expect(reports.map((r) => r.sql)).toEqual(['SELECT advance(600)']);
  });

  test('reports a query that throws', () => {
    const { db, reports } = setup();

    expect(() =>
      db.prepare('SELECT advance(600), * FROM missing_table').get(),
    ).toThrow();
    // Preparing fails before anything runs, so nothing is timed.
    expect(reports).toEqual([]);

    db.exec('CREATE TABLE t (n INTEGER NOT NULL)');
    expect(() =>
      db
        .prepare('INSERT INTO t VALUES (CASE WHEN advance(600) THEN NULL END)')
        .run(),
    ).toThrow(/NOT NULL/);
    expect(reports.map((r) => r.durationMs)).toEqual([600]);
  });

  test('reports queries from Drizzle and Kysely', async () => {
    const { db, reports } = setup();

    drizzle({ client: db }).all(drizzleSql`SELECT advance(600)`);
    const kysely = new Kysely({ dialect: new SqliteDialect({ database: db }) });
    await kyselySql`SELECT advance(700)`.execute(kysely);
    await kysely.destroy();

    expect(reports.map((r) => r.durationMs)).toEqual([600, 700]);
  });
});
