import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import { PlexServerSettingsTable } from './entity/PlexServerSettings.js';
import { globalOptions } from '../globals.js';
import path from 'path';
import { once } from 'lodash-es';

export interface Database {
  plexServerSettings: PlexServerSettingsTable;
}

const dialect = once(
  () =>
    new SqliteDialect({
      database: new SQLite(path.resolve(globalOptions().database, 'db.db')),
    }),
);

export const db = once(() => new Kysely<Database>({ dialect: dialect() }));
