import type { GlobalOptions } from '@/globals.js';
import { KEYS } from '@/types/inject.js';
import { SettingsJsonFilename } from '@/util/constants.js';
import { defaultLogRollConfig } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { merge } from 'lodash-es';
import { Low, LowSync } from 'lowdb';
import path from 'node:path';
import { isMainThread } from 'node:worker_threads';
import type { DeepPartial } from 'ts-essentials';
import { SchemaBackedDbAdapter } from './json/SchemaBackedJsonDBAdapter.ts';
import { SyncSchemaBackedDbAdapter } from './json/SyncSchemaBackedJSONDBAdapter.ts';
import type { SettingsFile } from './SettingsDB.ts';
import {
  CURRENT_VERSION,
  SettingsDB,
  SettingsFileSchema,
  defaultSettings,
} from './SettingsDB.ts';

@injectable()
export class SettingsDBFactory {
  private static INSTANCES: Map<string, SettingsDB> = new Map();

  constructor(
    @inject(KEYS.GlobalOptions) private globalOptions: GlobalOptions,
  ) {}

  get(
    dbPath?: string,
    initialSettings?: DeepPartial<SettingsFile>,
  ): SettingsDB {
    const actualPath =
      dbPath ??
      path.resolve(this.globalOptions.databaseDirectory, SettingsJsonFilename);

    const instance = SettingsDBFactory.INSTANCES.get(actualPath);
    if (instance) {
      return instance;
    }

    const defaultValue = merge(
      {},
      defaultSettings(this.globalOptions.databaseDirectory),
      initialSettings,
    );
    // Only the main thread may move a corrupt settings file aside. Workers
    // start after the main thread has already repaired it.
    const invalidJson = isMainThread ? 'move_aside' : 'ignore';

    // Load this synchronously, but then give the DB instance an async version
    const syncAdapter = new SyncSchemaBackedDbAdapter(
      SettingsFileSchema,
      actualPath,
      defaultValue,
      undefined,
      { invalidJson },
    );
    const db = new LowSync<SettingsFile>(syncAdapter, defaultValue);

    db.read();

    // An empty or corrupt file starts from defaults, exactly like a missing one.
    const freshSettings = syncAdapter.readFoundNoFile;

    // Only the main thread records startup state. Workers bootstrap through
    // the same entry point, all at once, and every thread in the process
    // writes through one scratch file (.settings.json.<pid>.tmp) before
    // renaming it into place, so
    // concurrent writers race on the rename and fail with ENOENT. The parent
    // has already written this file before it spawns any workers.
    if (isMainThread) {
      db.update((data) => {
        data.migration.isFreshSettings = freshSettings;
        // Redefine thie variable... it came before "isFreshSettings".
        // If this is a fresh run, mark legacyMigration as false
        if (freshSettings) {
          data.migration.legacyMigration = false;
        }
        // New installs are fresh and have effectively "migrated"
        data.migration.hasMigratedTo1_0 = freshSettings;

        // Log rolling used to default to off, and every install saved that
        // default. Turn it on once for installs that still have it off.
        if (!data.migration.hasEnabledLogRollByDefault) {
          if (!data.system.logging.logRollConfig.enabled) {
            data.system.logging.logRollConfig = defaultLogRollConfig();
          }
          data.migration.hasEnabledLogRollByDefault = true;
        }
      });
    }

    const settingsDB = new SettingsDB(
      new Low<SettingsFile>(
        new SchemaBackedDbAdapter(
          SettingsFileSchema,
          actualPath,
          defaultValue,
          undefined,
          { invalidJson },
        ),
        db.data,
      ),
    );
    SettingsDBFactory.INSTANCES.set(actualPath, settingsDB);

    if (db.data.version < CURRENT_VERSION) {
      // We need to perform a migration
    }

    return settingsDB;
  }
}
