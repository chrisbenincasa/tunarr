import { MigrationLockTableName, MigrationTableName } from '@/db/DBAccess.js';
import type { DB } from '@/db/schema/db.js';
import type { BaseDrizzleDBAccess } from '@/db/schema/index.js';
import dayjs from 'dayjs';
import { sql } from 'drizzle-orm';
import type { MigrationResultSet } from 'kysely';
import {
  type Kysely,
  type MigrationInfo,
  type MigrationResult,
  Migrator,
} from 'kysely';
import { head, last } from 'lodash-es';
import type { Logger } from '../util/logging/LoggerFactory.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import type { TunarrDatabaseMigration } from './DirectMigrationProvider.ts';
import { DirectMigrationProvider } from './DirectMigrationProvider.ts';

export interface TunarrMigrationInfo extends MigrationInfo {
  migration: TunarrDatabaseMigration;
}

/**
 * A hacky custom migrator that uses the backing kysely migration
 * tables to run generated Drizzle migrations. Eventually we will
 * consolidate :)
 */
export class DrizzleMigrator {
  private logger: Logger;
  private migrationProvider: DirectMigrationProvider =
    new DirectMigrationProvider();
  private kyselyMigrator: Migrator;

  constructor(
    private db: BaseDrizzleDBAccess,
    private kysely: Kysely<DB>,
  ) {
    this.logger = LoggerFactory.child({ className: DrizzleMigrator.name });
    this.kyselyMigrator = new Migrator({
      db: this.kysely,
      provider: this.migrationProvider,
      migrationTableName: MigrationTableName,
      migrationLockTableName: MigrationLockTableName,
    });
  }

  getMigrations(): TunarrMigrationInfo[] {
    const migrationsByName = this.migrationProvider.getMigrationsSync();

    const existingMigrations = this.getExistingMigrations();

    return Object.keys(migrationsByName)
      .sort()
      .map((key) => {
        const existingMigration = existingMigrations.find(
          ([name]) => name === key,
        );
        return {
          name: key,
          migration: migrationsByName[key]!,
          executedAt: existingMigration
            ? dayjs(existingMigration[1]).toDate()
            : undefined,
        } satisfies TunarrMigrationInfo;
      });
  }

  async migrateToLatest(): Promise<MigrationResultSet> {
    const migrations = this.getMigrations();
    const migration = last(migrations);
    if (!migration) {
      return { results: [] };
    }
    return this.migrateTo(migration.name);
  }

  async migrateTo(name: string): Promise<MigrationResultSet> {
    const migrations = this.getMigrations();
    const migrationIndex = migrations.findIndex((m) => m.name === name);
    if (migrationIndex === -1) {
      this.logger.warn(
        `Could not find migration with name %s to migrate to`,
        name,
      );
      return { results: [] };
    }
    const migration = migrations[migrationIndex]!;
    if (migration.executedAt) {
      this.logger.info(
        'Already migrated to %s at %s, skipping',
        name,
        migration.executedAt.toISOString(),
      );
      return { results: [] };
    }

    // Find the pending migrations between the target and last migration, including the target
    const pendingMigrations = migrations
      .slice(0, migrationIndex + 1)
      .filter((migration) => !migration.executedAt);

    const results: MigrationResult[] = pendingMigrations.map((migration) => ({
      migrationName: migration.name,
      direction: 'Up',
      status: 'NotExecuted',
    }));
    for (let i = 0; i < pendingMigrations.length; i++) {
      const pendingMigration = pendingMigrations[i]!;
      try {
        if (pendingMigration.migration.kyselyOnly) {
          const migrateResult = await this.kyselyMigrator.migrateTo(
            pendingMigration.name,
          );
          const result = head(migrateResult.results);
          if (result) {
            results[i] = result;
          }
          if (migrateResult.error) {
            return {
              error: migrateResult.error,
              results,
            };
          }
          continue;
        }

        pendingMigration.migration.upDrizzle(this.db);
        this.db.run(
          sql`INSERT INTO ${sql.identifier(MigrationTableName)} (name, timestamp) VALUES (${pendingMigration.name}, ${new Date().toISOString()})`,
        );
        results[i] = {
          direction: 'Up',
          migrationName: pendingMigration.name,
          status: 'Success',
        };
      } catch (e) {
        results[i] = {
          direction: 'Up',
          migrationName: pendingMigration.name,
          status: 'Error',
        };
        this.logger.error(
          e,
          'Error while migrating to %s',
          pendingMigration.name,
        );
        return { error: e, results };
      }
    }

    return { results };
  }

  private getExistingMigrations() {
    return this.db.values<[string, string]>(
      sql`SELECT name, timestamp FROM ${sql.identifier(MigrationTableName)} ORDER BY timestamp ASC`,
    );
  }
}
