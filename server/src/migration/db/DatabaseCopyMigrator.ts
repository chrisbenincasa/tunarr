import dayjs from 'dayjs';
import { type Kysely, sql } from 'kysely';
import { trimEnd } from 'lodash-es';
import fs from 'node:fs/promises';
import tmp from 'tmp-promise';
import {
  getDatabase,
  MigrationLockTableName,
  MigrationTableName,
  runDBMigrations,
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

  async migrate(currentDbPath: string, migrateTo?: string) {
    const { path: tmpPath } = await tmp.file({ keep: false });
    this.logger.debug('Migrating to temp DB %s', tmpPath);
    const tempDB = getDatabase(tmpPath);
    await runDBMigrations(tempDB, migrateTo);

    const oldDB = getDatabase(currentDbPath);
    const oldTables = await this.getTables(oldDB);
    const newTables = await this.getTables(tempDB);
    // Prepare for copy.
    await sql`PRAGMA foreign_keys = OFF;`.execute(tempDB);
    await sql`PRAGMA defer_foreign_keys = ON;`.execute(tempDB);
    await sql`ATTACH DATABASE ${sql.lit(currentDbPath)} AS 'old'`.execute(
      tempDB,
    );
    await sql`BEGIN TRANSACTION;`.execute(tempDB);
    for (const table of oldTables) {
      const newTable = newTables.find(
        (newTable) => newTable.name === table.name,
      );
      if (!newTable) {
        this.logger.debug(
          'Skipping table %s because it does not exist in target',
          table.name,
        );
        continue;
      }

      const columnUnion = new Set(table.columns.map((col) => col.name)).union(
        new Set(newTable.columns.map((col) => col.name)),
      );

      const colNames = [...columnUnion].sort();
      await sql`INSERT INTO ${sql.table(table.name)} (${sql.join(colNames.map((n) => sql.ref(n)))}) SELECT ${sql.join(colNames.map((n) => sql.ref(n)))} FROM ${sql.ref('old')}.${sql.table(table.name)} WHERE true ON CONFLICT DO NOTHING;`.execute(
        tempDB,
      );
    }
    await sql`END;`.execute(tempDB);
    await sql`PRAGMA foreign_keys = ON;`.execute(tempDB);
    await sql`PRAGMA defer_foreign_keys = OFF;`.execute(tempDB);

    await fs.copyFile(
      currentDbPath,
      `${trimEnd(currentDbPath, '.db')}-${+dayjs()}.bak`,
    );
    await fs.cp(tmpPath, currentDbPath);
    // Force reinit at the new path
    getDatabase(currentDbPath, true);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async getTables(db: Kysely<any>) {
    const tables = await db.introspection.getTables({
      withInternalKyselyTables: false,
    });
    return tables.filter(
      (table) =>
        table.name !== MigrationTableName &&
        table.name !== MigrationLockTableName,
    );
  }
}
