import Database from 'better-sqlite3';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import tmp from 'tmp-promise';
import { afterEach, describe, expect, it } from 'vitest';

/**
 * A write transaction must be started IMMEDIATE, not DEFERRED.
 *
 * SQLite takes the locks lazily for a deferred transaction: the first read
 * takes a read lock, and the write that follows has to UPGRADE that lock. When
 * another connection got the write lock in between, the upgrade fails with
 * SQLITE_BUSY **without the busy handler ever waiting** — so the 5s
 * `busy_timeout` the connection is opened with does not cover the case it
 * exists for (server/src/db/DBAccess.ts). An IMMEDIATE transaction takes the
 * write lock at BEGIN, so there is no upgrade to fail.
 *
 * This pins the difference rather than the argument passed at the call site:
 * the same body is run with each behavior and the two outcomes must differ.
 */
describe('write transactions start IMMEDIATE', () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) {
      await cleanup();
    }
  });

  async function probe(behavior: 'deferred' | 'immediate') {
    const dir = await tmp.dir({ unsafeCleanup: true });
    cleanups.push(() => dir.cleanup());
    const file = `${dir.path}/tunarr.sqlite`;

    const subject = new Database(file, { timeout: 5000 });
    subject.pragma('journal_mode = WAL');
    subject.exec('create table t (id integer primary key, v text)');
    // The competing connection fails fast, so the case where it cannot take the
    // lock does not cost the test the subject's real 5s budget.
    const competitor = new Database(file, { timeout: 50 });
    competitor.pragma('journal_mode = WAL');
    const db = drizzle(subject);

    const outcome = db.transaction(
      (tx) => {
        // Read first: this is what makes a deferred transaction take the read
        // lock before it ever wants to write.
        tx.run(sql`select * from t`);
        let other = 'acquired';
        try {
          competitor.exec('begin immediate');
          competitor.prepare('insert into t (v) values (?)').run('other');
          competitor.exec('commit');
        } catch {
          other = 'busy';
        }
        try {
          tx.run(sql`insert into t (v) values ('subject')`);
          return `${other}/write-ok`;
        } catch {
          return `${other}/write-busy`;
        }
      },
      { behavior },
    );

    subject.close();
    competitor.close();
    return outcome;
  }

  it('fails the deferred write the 5s busy timeout does not protect', async () => {
    await expect(probe('deferred')).resolves.toBe('acquired/write-busy');
  });

  it('lets the immediate write through, because the lock was taken up front', async () => {
    await expect(probe('immediate')).resolves.toBe('busy/write-ok');
  });
});
