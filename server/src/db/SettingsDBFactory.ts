import type { GlobalOptions } from '@/globals.js';
import { KEYS } from '@/types/inject.js';
import { SettingsJsonFilename } from '@/util/constants.js';
import { inject, injectable } from 'inversify';
import { merge } from 'lodash-es';
import { Low, LowSync } from 'lowdb';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DeepPartial } from 'ts-essentials';
import { SchemaBackedDbAdapter } from './json/SchemaBackedJsonDBAdapter.ts';
import { SyncSchemaBackedDbAdapter } from './json/SyncSchemaBackedJSONDBAdapter.ts';
import {
  CURRENT_VERSION,
  SettingsDB,
  SettingsFile,
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

    const freshSettings = !existsSync(actualPath);

    const defaultValue = merge(
      {},
      defaultSettings(this.globalOptions.databaseDirectory),
      initialSettings,
    );
    // Load this synchronously, but then give the DB instance an async version
    const db = new LowSync<SettingsFile>(
      new SyncSchemaBackedDbAdapter(
        SettingsFileSchema,
        actualPath,
        defaultValue,
      ),
      defaultValue,
    );

    db.read();
    db.update((data) => {
      data.migration.isFreshSettings = freshSettings;
      // Redefine thie variable... it came before "isFreshSettings".
      // If this is a fresh run, mark legacyMigration as false
      if (freshSettings) {
        data.migration.legacyMigration = false;
      }
      // New installs are fresh and have effectively "migrated"
      data.migration.hasMigratedTo1_0 = freshSettings;
    });

    const settingsDB = new SettingsDB(
      new Low<SettingsFile>(
        new SchemaBackedDbAdapter(SettingsFileSchema, actualPath, defaultValue),
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
