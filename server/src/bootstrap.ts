import languages from '@cospired/i18n-iso-languages';
import en from '@cospired/i18n-iso-languages/langs/en.json' with { type: 'json' };
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DeepPartial } from 'ts-essentials';
import { DBAccess } from './db/DBAccess.ts';
import type { SettingsFile } from './db/SettingsDB.ts';
import { SettingsDBFactory } from './db/SettingsDBFactory.ts';
import {
  type GlobalOptions,
  globalOptions,
  setGlobalOptionsUnchecked,
} from './globals.js';
import type { GlobalArgsType } from './cli/types.ts';
import {
  CacheFolderName,
  ChannelLineupsFolderName,
  ImagesFolderName,
  SubtitlesCacheFolderName,
} from './util/constants.ts';
import { fileExists } from './util/fsUtil.js';
import { LoggerFactory, RootLogger } from './util/logging/LoggerFactory.js';

/**
 * Initializes the Tunarr "database" directory at the configured location, including
 * subdirectories
 * @returns True if an existing database directory was found
 */
async function initDbDirectories(opts: GlobalOptions) {
  // Early init, have to use the non-settings-based root Logger
  for (const subpaths of [
    [ChannelLineupsFolderName],
    [ImagesFolderName],
    [CacheFolderName],
    [CacheFolderName, ImagesFolderName],
    [CacheFolderName, SubtitlesCacheFolderName],
    ['backups'],
  ]) {
    const pathToCheck = path.join(opts.databaseDirectory, ...subpaths);
    if (!(await fileExists(pathToCheck))) {
      RootLogger.debug(`Creating path at ${pathToCheck}`);
      await fs.mkdir(pathToCheck);
    }
  }

  // TODO: This will be an option that the user can set...
  if (!(await fileExists(path.join(opts.databaseDirectory, 'streams')))) {
    await fs.mkdir(path.join(opts.databaseDirectory, 'streams'));
  }
}

export async function bootstrapTunarr(
  opts: GlobalOptions = globalOptions(),
  dbName?: string, // This should only be set in tests
  initialSettings?: DeepPartial<SettingsFile>,
) {
  languages.registerLocale(en);

  const hasTunarrDb = await fileExists(opts.databaseDirectory);
  if (!hasTunarrDb) {
    RootLogger.info(
      `Existing database at ${opts.databaseDirectory} not found, creating it.`,
    );
    await fs.mkdir(opts.databaseDirectory, { recursive: true });
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
  const conn = DBAccess.init(dbName);

  // not the first run, use the copy migrator
  if (hasTunarrDb) {
    await DBAccess.instance.migrateExistingDatabase(conn.name);
  } else {
    await conn.syncMigrationTablesIfNecessary();
    await conn.runDBMigrations();
  }

  const dbDirContents = await fs.readdir(opts.databaseDirectory);
  const migrationBackups = dbDirContents
    .filter((entry) => entry.match(/db-(\d+)\.bak/))
    .sort();
  // Keep all but last 3
  const backupsToDelete = migrationBackups.slice(0, -3);

  await Promise.all(
    backupsToDelete.map((backup) =>
      fs.unlink(path.join(opts.databaseDirectory, backup)),
    ),
  );

  LoggerFactory.initialize(settingsDb);
}

/**
 * Lightweight bootstrap for tooling commands (e.g. generate-openapi).
 * Uses an ephemeral temp directory instead of the configured Tunarr data dir
 * so the command does not pollute or depend on the user's real data.
 * Returns the temp directory path so the caller can clean up.
 */
export async function bootstrapForTooling(
  opts: GlobalArgsType,
): Promise<string> {
  languages.registerLocale(en);

  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tunarr-'));

  // Override the database directory with the ephemeral temp dir.
  // setGlobalOptionsUnchecked bypasses the once() guard since setGlobalOptions
  // was already called by the middleware before this command handler runs.
  setGlobalOptionsUnchecked({ ...opts, database: tempDir });

  await initDbDirectories(globalOptions());

  const settingsDb = new SettingsDBFactory(globalOptions()).get();
  await settingsDb.flush();

  const conn = DBAccess.init();
  await conn.syncMigrationTablesIfNecessary();
  await conn.runDBMigrations();

  LoggerFactory.initialize(settingsDb);

  return tempDir;
}
