import Sqlite from 'better-sqlite3';
import { sql as drizzleSql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { Kysely, sql as kyselySql, SqliteDialect } from 'kysely';
import { describe, expect, test } from 'vitest';
import type { SlowQuery } from './slowQueryLog.ts';
import {
  DefaultSlowQueryThresholdMs,
  deferThen,
  MaxLoggedSqlLength,
  resolveSlowQueryThresholdMs,
  truncateSql,
  withSlowQueryLog,
} from './slowQueryLog.ts';

// advance(ms) moves a fake clock forward while SQLite runs the statement, the
// way a slow query spends real time inside the call.
function setup(thresholdMs = 500, prepareMs = 0) {
  let clock = 0;
  const raw = new Sqlite(':memory:');
  raw.function('advance', (ms: number) => {
    clock += ms;
    return ms;
  });
  const prepare = raw.prepare.bind(raw);
  raw.prepare = ((source: string) => {
    clock += prepareMs;
    return prepare(source);
  }) as typeof raw.prepare;

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

  test('reports a statement that is slow to prepare', () => {
    const { db, reports } = setup(500, 600);

    function prepareSlowStatement() {
      return db.prepare('SELECT 1 AS one');
    }

    expect(prepareSlowStatement().get()).toEqual({ one: 1 });
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      sql: 'SELECT 1 AS one',
      durationMs: 600,
    });
    expect(reports[0]?.callStack[0]).toContain('prepareSlowStatement');
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

  describe('names the code that awaited the query', () => {
    // Each statement calls advance(600), so the query itself is slow.
    const Slow = sqliteTable('slow', { n: integer('n') });

    function setupSlowTable() {
      const { db, reports } = setup();
      db.exec('CREATE TABLE slow (n INTEGER)');
      db.exec('INSERT INTO slow (n) VALUES (1)');
      return { db, reports };
    }

    function frameNamed(reports: SlowQuery[], name: string) {
      expect(reports).toHaveLength(1);
      return reports[0]?.callStack.find((frame) => frame.includes(name));
    }

    test('an awaited Drizzle insert', async () => {
      const { db, reports } = setupSlowTable();
      const d = drizzle({ client: db });

      async function insertSlowRow() {
        await d.insert(Slow).values({ n: drizzleSql`advance(600)` });
      }
      await insertSlowRow();

      expect(frameNamed(reports, 'insertSlowRow')).toBeDefined();
    });

    test('an awaited Drizzle select', async () => {
      const { db, reports } = setupSlowTable();
      const d = drizzle({ client: db });

      async function selectSlowRows() {
        return await d
          .select()
          .from(Slow)
          .where(drizzleSql`advance(600) > 0`);
      }
      await selectSlowRows();

      expect(frameNamed(reports, 'selectSlowRows')).toBeDefined();
    });

    test('an awaited Drizzle relational query', async () => {
      const { db, reports } = setupSlowTable();
      const d = drizzle({ client: db, schema: { Slow } });

      async function findSlowRows() {
        return await d.query.Slow.findMany({
          where: drizzleSql`advance(600) > 0`,
        });
      }
      await findSlowRows();

      expect(frameNamed(reports, 'findSlowRows')).toBeDefined();
    });

    test('an awaited Drizzle $count', async () => {
      const { db, reports } = setupSlowTable();
      const d = drizzle({ client: db });

      async function countSlowRows() {
        return await d.$count(Slow, drizzleSql`advance(600) > 0`);
      }
      await countSlowRows();

      expect(frameNamed(reports, 'countSlowRows')).toBeDefined();
    });

    test('a Kysely query', async () => {
      const { db, reports } = setupSlowTable();
      const kysely = new Kysely<{ slow: { n: number } }>({
        dialect: new SqliteDialect({ database: db }),
      });

      async function selectSlowRowsWithKysely() {
        return await kysely
          .selectFrom('slow')
          .selectAll()
          .where(kyselySql<boolean>`advance(600) > 0`)
          .execute();
      }
      await selectSlowRowsWithKysely();
      await kysely.destroy();

      expect(frameNamed(reports, 'selectSlowRowsWithKysely')).toBeDefined();
    });
  });
});

describe('resolveSlowQueryThresholdMs', () => {
  test('uses the default when nothing is configured', () => {
    expect(resolveSlowQueryThresholdMs(null)).toBe(DefaultSlowQueryThresholdMs);
  });

  test('uses a configured threshold', () => {
    expect(resolveSlowQueryThresholdMs(250)).toBe(250);
  });

  test('turns the log off at 0 or less', () => {
    expect(resolveSlowQueryThresholdMs(0)).toBeUndefined();
    expect(resolveSlowQueryThresholdMs(-1)).toBeUndefined();
  });
});

describe('truncateSql', () => {
  test('keeps SQL at the limit as is', () => {
    const sql = 'x'.repeat(MaxLoggedSqlLength);
    expect(truncateSql(sql)).toBe(sql);
  });

  test('cuts longer SQL at the limit and marks the cut', () => {
    const sql = 'x'.repeat(MaxLoggedSqlLength + 1);
    expect(truncateSql(sql)).toBe(`${'x'.repeat(MaxLoggedSqlLength)}…`);
  });
});

describe('deferThen', () => {
  test('leaves a prototype without then() alone', () => {
    class NoThen {}

    expect(deferThen(NoThen.prototype)).toBe(false);
    expect(Reflect.get(NoThen.prototype, 'then')).toBeUndefined();
  });

  test('still resolves to the original then() result', async () => {
    class Thenable {
      then(onFulfilled?: (value: number) => unknown) {
        return Promise.resolve(42).then(onFulfilled);
      }
    }

    expect(deferThen(Thenable.prototype)).toBe(true);
    expect(await new Thenable()).toBe(42);
  });
});
