import Sqlite from 'better-sqlite3';
import {
  CamelCasePlugin,
  Kysely,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely';
import { once } from 'lodash-es';
import path from 'path';
import { GlobalOptions } from '../../globals';
import { LoggerFactory } from '../../util/logging/LoggerFactory';
import { DB } from './derivedTypes.js';

let _directDbAccess: Kysely<DB>;

export const initDirectDbAccess = once((opts: GlobalOptions) => {
  _directDbAccess = new Kysely<DB>({
    dialect: new SqliteDialect({
      database: new Sqlite(path.join(opts.databaseDirectory, 'db.db')),
    }),
    log: (event) => {
      const logger = LoggerFactory.child({ className: 'DirectDBAccess' });
      switch (event.level) {
        case 'query':
          if (
            process.env['DATABASE_DEBUG_LOGGING'] ||
            process.env['DIRECT_DATABASE_DEBUG_LOGGING']
          ) {
            logger.debug(
              'Query: %O (%d ms)',
              event.query.sql,
              event.queryDurationMillis,
            );
          }
          return;
        case 'error':
          logger.error(event.error, 'Query error: %s', event.query);
          return;
      }
    },
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  });
});

export const directDbAccess = () => _directDbAccess;
