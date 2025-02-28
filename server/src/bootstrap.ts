import constants from '@tunarr/shared/constants';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DeepPartial } from 'ts-essentials';
import {
  databaseNeedsMigration,
  DBContext,
  getDatabase,
  makeDatabaseConnection,
  migrateExistingDatabase,
  runDBMigrations,
  syncMigrationTablesIfNecessary,
} from './db/DBAccess.ts';
import type { SettingsFile } from './db/SettingsDB.ts';
import { SettingsDBFactory } from './db/SettingsDBFactory.ts';
import { type GlobalOptions, globalOptions } from './globals.js';
import { getDefaultDatabaseName } from './util/defaults.ts';
import { copyDirectoryContents, fileExists } from './util/fsUtil.js';
import { LoggerFactory, RootLogger } from './util/logging/LoggerFactory.js';

export async function migrateFromPreAlphaDefaultDb(targetDir: string) {
  // In versions <=0.3.2, the default database directory was located
  // at process.cwd()/.tunarr
  const preAlphaPath = path.join(process.cwd(), constants.DEFAULT_DATA_DIR);
  const hasPreAlphaDefaultDb = await fileExists(preAlphaPath);
  if (hasPreAlphaDefaultDb) {
    await copyDirectoryContents(preAlphaPath, targetDir);
  }
}

/**
 * Initializes the Tunarr "database" directory at the configured location, including
 * subdirectories
 * @returns True if an existing database directory was found
 */
async function initDbDirectories(opts: GlobalOptions) {
  // Early init, have to use the non-settings-based root Logger
  for (const subpaths of [
    ['channel-lineups'],
    ['images'],
    ['cache'],
    ['cache', 'images'],
  ]) {
    const pathToCheck = path.join(opts.databaseDirectory, ...subpaths);
    if (!(await fileExists(pathToCheck))) {
      RootLogger.debug(`Creating path at ${pathToCheck}`);
      await fs.mkdir(pathToCheck);
    }
  }

  // TODO: This will be an option that the user can set...
  if (!(await fileExists(path.join(process.cwd(), 'streams')))) {
    await fs.mkdir(path.join(process.cwd(), 'streams'));
  }
}

export async function bootstrapTunarr(
  opts: GlobalOptions = globalOptions(),
  initialSettings?: DeepPartial<SettingsFile>,
) {
  const hasTunarrDb = await fileExists(opts.databaseDirectory);
  if (!hasTunarrDb) {
    RootLogger.info(`Existing database at ${opts.databaseDirectory} not found`);
    await fs.mkdir(opts.databaseDirectory, { recursive: true });
    await migrateFromPreAlphaDefaultDb(opts.databaseDirectory);
  }

  const settingsDb = new SettingsDBFactory(opts).get(
    undefined,
    initialSettings,
  );

  // Init the settings if we created the db directory
  if (!hasTunarrDb) {
    await settingsDb.flush();
  }

  await initDbDirectories(opts);
  await DBContext.create(makeDatabaseConnection(), async () => {
    const db = getDatabase(); // Initialize the DB

    // not the first run, use the copy migrator
    if (hasTunarrDb) {
      const migrationNecessary = await databaseNeedsMigration(db);
      if (migrationNecessary) {
        await migrateExistingDatabase(getDefaultDatabaseName());
      }
    } else {
      await syncMigrationTablesIfNecessary(db);
      await runDBMigrations(db);
    }
  });

  LoggerFactory.initialize(settingsDb);
}
