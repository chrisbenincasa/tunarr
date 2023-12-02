import fs from 'fs/promises';
import {
  FileMigrationProvider,
  Kysely,
  MigrationResultSet,
  Migrator,
  NO_MIGRATIONS,
} from 'kysely';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'path';
import createLogger from '../logger.js';
import { Database, db as getDb } from './dataSource.js';

const logger = createLogger(import.meta);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getMigrator(db: Kysely<Database>) {
  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });
}

function handleResults({ error, results }: MigrationResultSet) {
  results?.forEach((result) => {
    if (result.status === 'Success') {
      logger.info(`migrate ${result.migrationName} was successful`);
    } else if (result.status === 'Error') {
      logger.error(`migration ${result.migrationName} was unsuccessful`);
    }
  });

  if (error) {
    logger.error('Failed to migrate', error);
    throw error;
  }
}

export async function migrateToLatest() {
  const db = getDb();
  const migrator = getMigrator(db);

  try {
    handleResults(await migrator.migrateToLatest());
  } finally {
    await db.destroy();
  }
}

export async function resetDb() {
  const db = getDb();
  const migrator = getMigrator(db);

  try {
    handleResults(await migrator.migrateTo(NO_MIGRATIONS));
    handleResults(await migrator.migrateToLatest());
  } finally {
    await db.destroy();
  }
}
