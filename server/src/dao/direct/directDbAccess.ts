import { once } from 'lodash-es';
import { GlobalOptions } from '../../globals';
import { Kysely, SqliteDialect } from 'kysely';
import path from 'path';
import Sqlite from 'better-sqlite3';
import { DB } from './types.gen';

let _directDbAccess: Kysely<DB>;

export const initDirectDbAccess = once((opts: GlobalOptions) => {
  _directDbAccess = new Kysely<DB>({
    dialect: new SqliteDialect({
      database: new Sqlite(path.join(opts.databaseDirectory, 'db.db')),
    }),
    log: ['query'],
  });
});

export const directDbAccess = () => _directDbAccess;
