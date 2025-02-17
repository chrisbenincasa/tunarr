import { sql } from 'kysely';
import { orderBy } from 'lodash-es';
import fs from 'node:fs/promises';
import tmp from 'tmp-promise';
import {
  getDatabase,
  MigrationLockTableName,
  MigrationTableName,
  runPendingMigrations,
} from '../../db/DBAccess.ts';
import { LoggerFactory } from '../../util/logging/LoggerFactory.ts';

/**
 * Migrates DB schema by creating a new sqlite file and copying all
 * of the data over.
 */
export class DatabaseCopyMigrator {
  private logger = LoggerFactory.child({
    className: DatabaseCopyMigrator.name,
  });

  async migrate(currentDbPath: string) {
    const { path: tmpPath } = await tmp.file({ keep: true });
    this.logger.debug('Migrating to temp DB %s', tmpPath);
    const tempDB = getDatabase(tmpPath);
    await runPendingMigrations(tempDB);

    const oldDB = getDatabase(currentDbPath);
    const oldTables = (
      await oldDB.introspection.getTables({
        withInternalKyselyTables: false,
      })
    ).filter(
      (table) =>
        table.name !== MigrationTableName &&
        table.name !== MigrationLockTableName,
    );
    // Prepare for copy.
    await sql`PRAGMA foreign_keys = OFF;`.execute(tempDB);
    await sql`PRAGMA defer_foreign_keys = ON;`.execute(tempDB);
    await sql`ATTACH DATABASE ${sql.lit(currentDbPath)} AS 'old'`.execute(
      tempDB,
    );
    await sql`BEGIN TRANSACTION;`.execute(tempDB);
    for (const table of oldTables) {
      const columns = orderBy(table.columns, (col) => col.name);
      const colNames = columns.map((col) => col.name);
      await sql`INSERT INTO ${sql.table(table.name)} (${sql.join(colNames.map((n) => sql.ref(n)))}) SELECT ${sql.join(colNames.map((n) => sql.ref(n)))} FROM ${sql.ref('old')}.${sql.table(table.name)} WHERE true ON CONFLICT DO NOTHING;`.execute(
        tempDB,
      );
    }
    await sql`END;`.execute(tempDB);
    await sql`PRAGMA foreign_keys = ON;`.execute(tempDB);
    await sql`PRAGMA defer_foreign_keys = OFF;`.execute(tempDB);

    await fs.copyFile(currentDbPath, `${currentDbPath}.bak`);
    await fs.rename(tmpPath, currentDbPath);
    // Force reinit at the new path
    getDatabase(currentDbPath, true);
  }
}
