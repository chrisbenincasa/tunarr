import { attempt, isNonEmptyString } from '@/util/index.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { Mutex } from 'async-mutex';
import Sqlite from 'better-sqlite3';
import dayjs from 'dayjs';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  CamelCasePlugin,
  Kysely,
  Migrator,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely';
import { findIndex, has, isError, last, map, slice } from 'lodash-es';
import { DatabaseCopyMigrator } from '../migration/db/DatabaseCopyMigrator.ts';
import {
  DirectMigrationProvider,
  LegacyMigrationNameToNewMigrationName,
} from '../migration/DirectMigrationProvider.ts';
import type { Maybe } from '../types/util.ts';
import { getDefaultDatabaseName } from '../util/defaults.ts';
import type { DB } from './schema/db.ts';
import type { DrizzleDBAccess } from './schema/index.ts';
import { schema } from './schema/index.ts';

const lock = new Mutex();

export const MigrationTableName = 'migrations';
export const MigrationLockTableName = 'migration_lock';

class Connection {
  private logger!: Logger;

  readonly kysely!: Kysely<DB>;
  readonly drizzle!: DrizzleDBAccess;
  readonly sqlite!: Sqlite.Database;

  constructor(readonly name: string) {
    this.logger = LoggerFactory.child({
      className: Connection.name,
      dbName: name,
    });
    this.sqlite = new Sqlite(name, {
      timeout: 5000,
    });

    // Write to a separate WAL file, reads continue from main database
    // Multiple readers can work simultaneously with one writer.
    this.sqlite.pragma('journal_mode = WAL');
    // Syncs to disk at critical moments, but not after every write.
    // ~2-3x faster writes than FULL synchronization.
    this.sqlite.pragma('synchronous = NORMAL');
    // Use RAM for temporary operations (temp tables, sorting)
    this.sqlite.pragma('temp_store = MEMORY');
    // Keeps 10k DB pages in RAM; adds about 40MB of memory overhead.
    this.sqlite.pragma('cache_size = 10000');
    this.sqlite.pragma('mmap_size = 268435456');
    this.sqlite.pragma('foreign_keys = ON');

    this.kysely = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: this.sqlite,
      }),
      log: (event) => {
        switch (event.level) {
          case 'query':
            if (process.env['DATABASE_DEBUG_LOGGING']) {
              this.logger.debug(
                'Query: %s (%d ms)',
                event.query.sql,
                event.queryDurationMillis,
              );
            }
            return;
          case 'error':
            this.logger.error(
              event.error,
              'Query error: %s\n%O',
              event.query.sql,
              event.query.parameters,
            );
            return;
        }
      },
      plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
    });

    this.drizzle = drizzle({
      client: this.sqlite,
      casing: 'snake_case',
      schema,
      logger: process.env['DATABASE_DEBUG_LOGGING']
        ? {
            logQuery: (query, params) => {
              this.logger.debug(
                'Query: %s. Params: %s',
                query,
                JSON.stringify(params),
              );
            },
          }
        : false,
    });
  }

  private get db() {
    return this.kysely;
  }

  async pendingDatabaseMigrations() {
    return lock.runExclusive(async () => {
      const tables = await this.db.introspection.getTables({
        withInternalKyselyTables: true,
      });
      if (!tables.some((table) => table.name === MigrationTableName)) {
        return this.getMigrator().getMigrations();
      }

      const executedMigrations =
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (this.db as Kysely<any>)
          .selectFrom(MigrationTableName)
          .select('name')
          .orderBy(['timestamp', 'name'])
          .execute();
      const executedMigrationNames = executedMigrations.map(
        (migration) => migration.name as string,
      );
      const migrator = this.getMigrator();
      const knownMigrations = await migrator.getMigrations();
      return knownMigrations.filter(
        (migration) => !executedMigrationNames.includes(migration.name),
      );
    });
  }

  async databaseNeedsMigration() {
    return (await this.pendingDatabaseMigrations()).length > 0;
  }

  getMigrator() {
    return new Migrator({
      db: this.db,
      provider: new DirectMigrationProvider(),
      migrationTableName: MigrationTableName,
      migrationLockTableName: MigrationLockTableName,
    });
  }

  async syncMigrationTablesIfNecessary() {
    const tables = await this.db.introspection.getTables({
      withInternalKyselyTables: true,
    });

    const newMigrationTableExists = tables.some(
      (table) => table.name === MigrationTableName,
    );

    const legacyMigrationTableExists = tables.some(
      (table) => table.name === 'mikro_orm_migrations',
    );

    const migrator = this.getMigrator();

    // If this is a fresh install, no tables exist. Check if the mikro-orm migrations table
    // is there and if not
    if (!newMigrationTableExists && legacyMigrationTableExists) {
      // This will run our placeholder "first" migration which will
      // force kysely to create the migration tables.
      // Now port over the legacy migrations
      await migrator.migrateUp();

      const result = await attempt(async () => {
        const previouslyRunLegacyMigrations = await this.db
          .selectFrom('mikroOrmMigrations')
          .selectAll()
          .orderBy('id asc')
          .execute();

        const lastRunMigration = last(previouslyRunLegacyMigrations);
        if (lastRunMigration) {
          const indexOfNextMigration =
            findIndex(
              LegacyMigrationNameToNewMigrationName,
              ([legacyName]) => legacyName === lastRunMigration.name,
            ) + 1;

          if (
            indexOfNextMigration ===
            LegacyMigrationNameToNewMigrationName.length
          ) {
            this.logger.debug('Migrations are all up to date.');
          }

          const alreadyRunMigrations = slice(
            LegacyMigrationNameToNewMigrationName,
            0,
            indexOfNextMigration,
          );

          const now = dayjs();
          const newMigrationRows = map(
            alreadyRunMigrations,
            ([, newMigrationName]) => {
              return {
                name: newMigrationName,
                timestamp: now.add(1).toISOString(),
              };
            },
          );

          this.logger.debug(
            'Detected %d already run legacy migration (last %s)',
            alreadyRunMigrations.length,
            last(alreadyRunMigrations)?.[1],
          );

          this.logger.debug('Fast-forwarding migrations: %O', newMigrationRows);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (this.db as Kysely<any>)
            .insertInto(MigrationTableName)
            .values(newMigrationRows)
            .execute();
        }
      });

      // Try to reset state so we can try again on the next run
      if (isError(result)) {
        await migrator.migrateDown();
        await this.db.schema.dropTable(MigrationTableName).ifExists().execute();
        await this.db.schema
          .dropTable(MigrationLockTableName)
          .ifExists()
          .execute();
      }
    } else {
      this.logger.debug('New migration table already exists');
    }
  }

  async runDBMigrations(migrateTo?: string) {
    const migrator = this.getMigrator();
    const { error, results } = await (isNonEmptyString(migrateTo)
      ? migrator.migrateTo(migrateTo)
      : migrator.migrateToLatest());

    results?.forEach((it) => {
      if (it.status === 'Success') {
        this.logger.debug(
          `migration "${it.migrationName}" was executed successfully`,
        );
      } else if (it.status === 'Error') {
        this.logger.error(`failed to execute migration "${it.migrationName}"`);
      }
    });

    if (error) {
      this.logger.error(error, 'failed to run `migrateToLatest`');
    }
  }
}

export class DBAccess {
  static instance: DBAccess = new DBAccess();
  private static didInit = false;
  private static connections: Map<string, Connection> = new Map();

  static init(): Connection {
    const name = getDefaultDatabaseName();
    if (!this.didInit) {
      this.connections.set(name, new Connection(name));
    }
    return this.connections.get(name)!;
  }

  get db(): Maybe<Kysely<DB>> {
    return this.getKyselyDatabase();
  }

  get drizzle(): Maybe<DrizzleDBAccess> {
    return this.getConnection()?.drizzle;
  }

  getConnection(name: string = getDefaultDatabaseName()): Maybe<Connection> {
    return DBAccess.connections.get(name);
  }

  getKyselyDatabase(
    name: string = getDefaultDatabaseName(),
  ): Maybe<Kysely<DB>> {
    return this.getConnection(name)?.kysely;
  }

  getOrCreateKyselyDatabase(name?: string): Kysely<DB> {
    return this.getOrCreateConnection(name).kysely;
  }

  getOrCreateConnection(name: string = getDefaultDatabaseName()): Connection {
    const existing = DBAccess.connections.get(name);
    if (existing) {
      return existing;
    }
    const conn = new Connection(name);
    DBAccess.connections.set(name, conn);
    return conn;
  }

  setConnection(name: string) {
    DBAccess.connections.set(name, new Connection(name));
  }

  async closeConnection(name: string) {
    const conn = DBAccess.connections.get(name);
    conn?.sqlite.close();
    await conn?.kysely.destroy();
    DBAccess.connections.delete(name);
  }

  async migrateExistingDatabase(dbPathToMigrate: string) {
    const conn = this.getOrCreateConnection(dbPathToMigrate);
    if (!(await conn.databaseNeedsMigration())) {
      return;
    }
    const pendingMigrations = await conn.pendingDatabaseMigrations();

    const copyMigrator = new DatabaseCopyMigrator(this);
    for (const migration of pendingMigrations) {
      if (
        (has(migration.migration, 'fullCopy') &&
          migration.migration.fullCopy) ||
        (has(migration.migration, 'inPlace') && !migration.migration.inPlace)
      ) {
        await copyMigrator.migrate(dbPathToMigrate, migration.name);
      } else {
        // Refresh the connection every time.
        await this.getOrCreateConnection(dbPathToMigrate).runDBMigrations(
          migration.name,
        );
      }
    }
  }

  getMigrator(dbPath?: string) {
    return new Migrator({
      db: this.getKyselyDatabase(dbPath)!,
      provider: new DirectMigrationProvider(),
      migrationTableName: MigrationTableName,
      migrationLockTableName: MigrationLockTableName,
    });
  }
}
