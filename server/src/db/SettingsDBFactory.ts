import type { GlobalOptions } from '@/globals.js';
import { KEYS } from '@/types/inject.js';
import { SETTINGS_JSON_FILENAME } from '@/util/constants.js';
import { inject, injectable } from 'inversify';
import { merge } from 'lodash-es';
import { Low, LowSync } from 'lowdb';
import { existsSync } from 'node:fs';
import path from 'path';
import { DeepPartial } from 'ts-essentials';
import { SchemaBackedDbAdapter } from './SchemaBackedJsonDBAdapter.ts';
import {
  CURRENT_VERSION,
  SettingsDB,
  SettingsFile,
  SettingsFileSchema,
  defaultSettings,
} from './SettingsDB.ts';
import { SyncSchemaBackedDbAdapter } from './SyncSchemaBackedJSONDBAdapter.ts';

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
      path.resolve(
        this.globalOptions.databaseDirectory,
        SETTINGS_JSON_FILENAME,
      );

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
