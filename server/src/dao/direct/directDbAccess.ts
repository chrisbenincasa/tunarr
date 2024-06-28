import { once } from 'lodash-es';
import { GlobalOptions } from '../../globals';
import {
  CamelCasePlugin,
  Kysely,
  ParseJSONResultsPlugin,
  SqliteDialect,
} from 'kysely';
import path from 'path';
import Sqlite from 'better-sqlite3';
import { DB } from './derivedTypes.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory';

let _directDbAccess: Kysely<DB>;

export const initDirectDbAccess = once((opts: GlobalOptions) => {
  _directDbAccess = new Kysely<DB>({
    dialect: new SqliteDialect({
      database: new Sqlite(path.join(opts.databaseDirectory, 'db.db')),
    }),
    log: (event) => {
      const logger = LoggerFactory.root;
      switch (event.level) {
        case 'query':
          if (process.env['DATABASE_DEBUG_LOGGING']) {
            logger.debug(
              'Query: %O (%d ms)',
              event.query.sql,
              event.queryDurationMillis,
            );
          }
          return;
        case 'error':
          logger.error(event.error, 'Query error', event.query);
          return;
      }
    },
    plugins: [new ParseJSONResultsPlugin(), new CamelCasePlugin()],
  });
});

export const directDbAccess = () => _directDbAccess;
