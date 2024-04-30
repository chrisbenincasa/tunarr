import constants from '@tunarr/shared/constants';
import fs from 'node:fs/promises';
import path from 'path';
import { DeepPartial } from 'ts-essentials';
import {
  initDirectDbAccess,
  syncMigrationTablesIfNecessary,
} from './dao/direct/directDbAccess.ts';
import { SettingsFile, getSettings } from './dao/settings.js';
import { globalOptions } from './globals.js';
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
} /**
 * Initializes the Tunarr "database" directory at the configured location, including
 * subdirectories
 * @returns True if an existing database directory was found
 */

export async function initDbDirectories() {
  // Early init, have to use the non-settings-based root Logger
  const opts = globalOptions();
  const hasTunarrDb = await fileExists(opts.databaseDirectory);
  if (!hasTunarrDb) {
    RootLogger.debug(
      `Existing database at ${opts.databaseDirectory} not found`,
    );
    await fs.mkdir(opts.databaseDirectory, { recursive: true });
    await migrateFromPreAlphaDefaultDb(opts.databaseDirectory);
    await getSettings().flush();
  }

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

  return hasTunarrDb;
}

export async function bootstrapTunarr(
  initialSettings?: DeepPartial<SettingsFile>,
) {
  await initDbDirectories();
  initDirectDbAccess(path.join(globalOptions().databaseDirectory, 'db.db'));
  await syncMigrationTablesIfNecessary();
  const settingsDb = getSettings(undefined, initialSettings);
  LoggerFactory.initialize(settingsDb);
}
