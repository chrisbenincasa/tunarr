import { attempt, isNonEmptyString } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { Mutex } from 'async-mutex';
import Sqlite from 'better-sqlite3';
import dayjs from 'dayjs';
import {
  drizzle,
  type BetterSQLite3Database,
} from 'drizzle-orm/better-sqlite3';
import type {
  IsolationLevel,
  KyselyConfig,
  KyselyProps,
  Transaction,
} from 'kysely';
import {
  CamelCasePlugin,
  DefaultConnectionProvider,
  DefaultQueryExecutor,
  Kysely,
  Log,
  Migrator,
  ParseJSONResultsPlugin,
  RuntimeDriver,
  SqliteDialect,
  TransactionBuilder,
} from 'kysely';
import { findIndex, has, isError, last, map, once, slice } from 'lodash-es';
import { AsyncLocalStorage } from 'node:async_hooks';
import { DatabaseCopyMigrator } from '../migration/db/DatabaseCopyMigrator.ts';
import {
  DirectMigrationProvider,
  LegacyMigrationNameToNewMigrationName,
} from '../migration/DirectMigrationProvider.ts';
import type { Maybe } from '../types/util.ts';
import { getDefaultDatabaseName } from '../util/defaults.ts';
import type { DB } from './schema/db.ts';

const lock = new Mutex();

export const MigrationTableName = 'migrations';
export const MigrationLockTableName = 'migration_lock';

// let _directDbAccess: Kysely<DB>;
type Conn = {
  name: string;
  kysely: Kysely<DB>;
  drizzle: BetterSQLite3Database;
};

const connections = new Map<string, Conn>();

const logger = once(() => LoggerFactory.child({ className: 'DirectDBAccess' }));

export class DBContext {
  private static storage = new AsyncLocalStorage<DBContext>();

  constructor(private connections: Map<string, Conn> = new Map()) {}

  get db(): Maybe<Kysely<DB>> {
    return this.getKyselyDatabase();
  }

  getConnection(name: string = getDefaultDatabaseName()): Maybe<Conn> {
    return this.connections.get(name);
  }

  getKyselyDatabase(
    name: string = getDefaultDatabaseName(),
  ): Maybe<Kysely<DB>> {
    return this.getConnection(name)?.kysely;
  }

  getOrCreateKyselyDatabase(name: string): Kysely<DB> {
    return this.getOrCreateConnection(name)?.kysely;
  }

  getOrCreateConnection(name: string): Conn {
    const existing = this.connections.get(name);
    if (existing) {
      return existing;
    }
    const conn = makeDatabaseConnection(name);
    this.connections.set(name, conn);
    return conn;
  }

  setConnection(name: string) {
    this.connections.set(name, makeDatabaseConnection(name));
  }

  static create<T>(context: Conn, next: (...args: unknown[]) => T) {
    const m = new Map<string, Conn>([[context.name, context]]);
    return this.storage.run(new DBContext(m), next);
  }

  static createForName<T>(name: string, next: (...args: unknown[]) => T) {
    if (connections.has(name)) {
      return this.create(connections.get(name)!, next);
    }
    return this.create(makeDatabaseConnection(name), next);
  }

  static enter(context: Conn) {
    const m = new Map<string, Conn>([[context.name, context]]);
    this.storage.enterWith(new DBContext(m));
  }

  static currentDBContext(): Maybe<DBContext> {
    return this.storage.getStore();
  }
}

class TransactionBuilderWrapper extends TransactionBuilder<DB> {
  constructor(
    private dbName: string,
    props: KyselyProps & { isolationLevel?: IsolationLevel },
  ) {
    super(props);
  }

  execute<T>(callback: (trx: Transaction<DB>) => Promise<T>): Promise<T> {
    return super.execute((tx) => {
      const curr = DBContext.currentDBContext()?.getConnection(this.dbName);
      if (!curr) {
        throw new Error('no DB context');
      }

      return DBContext.create({ ...curr, kysely: tx }, () => callback(tx));
    });
  }
}

class KyselyWrapper extends Kysely<DB> {
  constructor(
    private dbName: string,
    private config: KyselyConfig,
  ) {
    super(config);
  }

  transaction(): TransactionBuilder<DB> {
    const driver = new RuntimeDriver(
      this.config.dialect.createDriver(),
      new Log(this.config.log ?? []),
    );
    return new TransactionBuilderWrapper(this.dbName, {
      config: this.config,
      dialect: this.config.dialect,
      driver,
      executor: new DefaultQueryExecutor(
        this.config.dialect.createQueryCompiler(),
        this.config.dialect.createAdapter(),
        new DefaultConnectionProvider(driver),
        this.config.plugins ?? [],
      ),
    });
  }
}

export function makeDatabaseConnection(
  dbName: string = getDefaultDatabaseName(),
): Conn {
  const dbConn = new Sqlite(dbName, {
    timeout: 5000,
  });

  const kysely = new KyselyWrapper(dbName, {
    dialect: new SqliteDialect({
      database: dbConn,
    }),
    log: (event) => {
      switch (event.level) {
        case 'query':
          if (
            process.env['DATABASE_DEBUG_LOGGING'] ||
            process.env['DIRECT_DATABASE_DEBUG_LOGGING']
          ) {
            logger().setBindings({ db: dbName });
            logger().debug(
              'Query: %O (%d ms)',
              event.query.sql,
              event.queryDurationMillis,
            );
          }
          return;
        case 'error':
          logger().setBindings({ db: dbName });
          logger().error(
            event.error,
            'Query error: %O\n%O',
            event.query.sql,
            event.query.parameters,
          );
          return;
      }
    },
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  });

  const drizzleConn = drizzle({
    client: dbConn,
    casing: 'snake_case',
  });

  const connection = { name: dbName, kysely, drizzle: drizzleConn };

  connections.set(dbName, connection);

  return connection;
}

export function getDatabaseContext() {
  return DBContext.currentDBContext();
}

export const getDatabase = (
  dbName: string = getDefaultDatabaseName(),
  forceInit: boolean = false,
) => {
  if (forceInit) {
    DBContext.enter(makeDatabaseConnection(dbName));
  }
  return DBContext.currentDBContext()!.getKyselyDatabase(dbName)!;
};

export function getMigrator(db: Kysely<DB> = getDatabase()) {
  return new Migrator({
    db,
    provider: new DirectMigrationProvider(),
    migrationTableName: MigrationTableName,
    migrationLockTableName: MigrationLockTableName,
  });
}

export async function pendingDatabaseMigrations(db: Kysely<DB>) {
  return lock.runExclusive(async () => {
    const tables = await db.introspection.getTables({
      withInternalKyselyTables: true,
    });
    if (!tables.some((table) => table.name === MigrationTableName)) {
      return getMigrator(db).getMigrations();
    }

    const executedMigrations =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (db as Kysely<any>)
        .selectFrom(MigrationTableName)
        .select('name')
        .orderBy(['timestamp', 'name'])
        .execute();
    const executedMigrationNames = executedMigrations.map(
      (migration) => migration.name as string,
    );
    const migrator = getMigrator(db);
    const knownMigrations = await migrator.getMigrations();
    return knownMigrations.filter(
      (migration) => !executedMigrationNames.includes(migration.name),
    );
  });
}

export async function databaseNeedsMigration(db: Kysely<DB>) {
  return (await pendingDatabaseMigrations(db)).length > 0;
}

export async function syncMigrationTablesIfNecessary(
  db: Kysely<DB> = getDatabase(),
) {
  const tables = await db.introspection.getTables({
    withInternalKyselyTables: true,
  });

  const newMigrationTableExists = tables.some(
    (table) => table.name === MigrationTableName,
  );

  const legacyMigrationTableExists = tables.some(
    (table) => table.name === 'mikro_orm_migrations',
  );

  const migrator = getMigrator();

  // If this is a fresh install, no tables exist. Check if the mikro-orm migrations table
  // is there and if not
  if (!newMigrationTableExists && legacyMigrationTableExists) {
    // This will run our placeholder "first" migration which will
    // force kysely to create the migration tables.
    // Now port over the legacy migrations
    await migrator.migrateUp();

    const result = await attempt(async () => {
      const previouslyRunLegacyMigrations = await db
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
          indexOfNextMigration === LegacyMigrationNameToNewMigrationName.length
        ) {
          logger().debug('Migrations are all up to date.');
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

        logger().debug(
          'Detected %d already run legacy migration (last %s)',
          alreadyRunMigrations.length,
          last(alreadyRunMigrations)?.[1],
        );

        logger().debug('Fast-forwarding migrations: %O', newMigrationRows);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (db as Kysely<any>)
          .insertInto(MigrationTableName)
          .values(newMigrationRows)
          .execute();
      }
    });

    // Try to reset state so we can try again on the next run
    if (isError(result)) {
      await migrator.migrateDown();
      await db.schema.dropTable(MigrationTableName).ifExists().execute();
      await db.schema.dropTable(MigrationLockTableName).ifExists().execute();
    }
  } else {
    logger().debug('New migration table already exists');
  }
}

export async function runDBMigrations(db: Kysely<DB>, migrateTo?: string) {
  const _logger = logger();
  const migrator = getMigrator(db);
  const { error, results } = await (isNonEmptyString(migrateTo)
    ? migrator.migrateTo(migrateTo)
    : migrator.migrateToLatest());

  results?.forEach((it) => {
    if (it.status === 'Success') {
      _logger.info(`migration "${it.migrationName}" was executed successfully`);
    } else if (it.status === 'Error') {
      _logger.error(`failed to execute migration "${it.migrationName}"`);
    }
  });

  if (error) {
    _logger.error(error, 'failed to run `migrateToLatest`');
  }
}

// Runs through pending migrations, using the DB copier if necessary
export async function migrateExistingDatabase(dbPath: string) {
  const db = getDatabase(dbPath);
  const pendingMigrations = await pendingDatabaseMigrations(db);

  const copyMigrator = new DatabaseCopyMigrator();
  for (const migration of pendingMigrations) {
    if (
      (has(migration.migration, 'fullCopy') && migration.migration.fullCopy) ||
      (has(migration.migration, 'inPlace') && !migration.migration.inPlace)
    ) {
      await copyMigrator.migrate(dbPath, migration.name);
    } else {
      await runDBMigrations(getDatabase(dbPath), migration.name);
    }
  }
}
