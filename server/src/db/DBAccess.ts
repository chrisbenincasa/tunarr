import Sqlite from 'better-sqlite3';
import dayjs from 'dayjs';
import {
  CamelCasePlugin,
  Kysely,
  Migrator,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely';
import { findIndex, isError, last, map, once, slice } from 'lodash-es';
import {
  DirectMigrationProvider,
  LegacyMigrationNameToNewMigrationName,
} from '../migration/DirectMigrationProvider.ts';
import { attempt } from '../util/index.ts';
import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { DB } from './schema/db.ts';

const MigrationTableName = 'migrations';
const MigrationLockTableName = 'migration_lock';

let _directDbAccess: Kysely<DB>;

const logger = once(() => LoggerFactory.child({ className: 'DirectDBAccess' }));

export const initDatabaseAccess = once((dbName: string) => {
  _directDbAccess = new Kysely<DB>({
    dialect: new SqliteDialect({
      database: new Sqlite(dbName, {
        timeout: 5000,
      }),
    }),
    log: (event) => {
      switch (event.level) {
        case 'query':
          if (
            process.env['DATABASE_DEBUG_LOGGING'] ||
            process.env['DIRECT_DATABASE_DEBUG_LOGGING']
          ) {
            logger().debug(
              'Query: %O (%d ms)',
              event.query.sql,
              event.queryDurationMillis,
            );
          }
          return;
        case 'error':
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
});

export const getDatabase = () => _directDbAccess;

function getMigrator() {
  return new Migrator({
    db: getDatabase(),
    provider: new DirectMigrationProvider(),
    migrationTableName: MigrationTableName,
    migrationLockTableName: MigrationLockTableName,
  });
}

export async function syncMigrationTablesIfNecessary() {
  const tables = await getDatabase().introspection.getTables({
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
      const previouslyRunLegacyMigrations = await getDatabase()
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
        await (getDatabase() as Kysely<any>)
          .insertInto(MigrationTableName)
          .values(newMigrationRows)
          .execute();
      }
    });

    // Try to reset state so we can try again on the next run
    if (isError(result)) {
      await migrator.migrateDown();
      await getDatabase()
        .schema.dropTable(MigrationTableName)
        .ifExists()
        .execute();
      await getDatabase()
        .schema.dropTable(MigrationLockTableName)
        .ifExists()
        .execute();
    }
  } else {
    logger().debug('New migration table already exists');
  }

  const _logger = logger();
  const { error, results } = await migrator.migrateToLatest();

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

export async function runPendingMigrations() {
  return await getMigrator().migrateToLatest();
}
