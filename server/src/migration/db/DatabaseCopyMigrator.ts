import dayjs from 'dayjs';
import { type Kysely, sql } from 'kysely';
import { replace } from 'lodash-es';
import fs from 'node:fs/promises';
import tmp from 'tmp-promise';
import { SqliteDatabaseBackup } from '../../db/backup/SqliteDatabaseBackup.ts';
import type { DBAccess } from '../../db/DBAccess.ts';
import {
  MigrationLockTableName,
  MigrationTableName,
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

  constructor(private dbAccess: DBAccess) {}

  async migrate(currentDbPath: string, migrateTo?: string) {
    const { path: tmpPath } = await tmp.file({ keep: false });
    this.logger.debug('Migrating to temp DB %s', tmpPath);
    const tempDBConn = this.dbAccess.getOrCreateConnection(tmpPath);
    const tempDB = tempDBConn.kysely;

    // Copy the existing DB to the new target
    await new SqliteDatabaseBackup().backup(currentDbPath, tmpPath);
    await tempDBConn.runDBMigrations(migrateTo);

    // Backup the old DB
    await new SqliteDatabaseBackup().backup(
      currentDbPath,
      `${replace(currentDbPath, '.db', '')}-${+dayjs()}.bak`,
    );

    const oldDB = this.dbAccess.getOrCreateKyselyDatabase(currentDbPath);
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

      const columnIntersection = new Set(
        table.columns.map((col) => col.name),
      ).intersection(new Set(newTable.columns.map((col) => col.name)));

      const colNames = [...columnIntersection].sort();
      await sql`INSERT INTO ${sql.table(table.name)} (${sql.join(colNames.map((n) => sql.ref(n)))}) SELECT ${sql.join(colNames.map((n) => sql.ref(n)))} FROM ${sql.ref('old')}.${sql.table(table.name)} WHERE true ON CONFLICT DO NOTHING;`.execute(
        tempDB,
      );
    }
    await sql`END;`.execute(tempDB);
    await sql`PRAGMA foreign_keys = ON;`.execute(tempDB);
    await sql`PRAGMA defer_foreign_keys = OFF;`.execute(tempDB);

    // Explicitly close both connections to close underlying files
    // Required to do before the copy of the tmp DB, in Windows
    await this.dbAccess.closeConnection(tmpPath);
    await this.dbAccess.closeConnection(currentDbPath);
    await fs.cp(tmpPath, currentDbPath);
    // Force reinit at the new path
    this.dbAccess.setConnection(currentDbPath);
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
