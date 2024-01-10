import type {
  BetterSqliteDriver,
  SqlEntityManager,
} from '@mikro-orm/better-sqlite'; // or any other driver package
import fs from 'fs';
import { MikroORM } from '@mikro-orm/better-sqlite';
import {
  CreateContextOptions,
  RequestContext,
  UnderscoreNamingStrategy,
} from '@mikro-orm/core';
import { isUndefined, once } from 'lodash-es';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';

// Temporary
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const logger = createLogger(import.meta);

export const initOrm = once(async () => {
  const dbPath = path.join(globalOptions().database, 'db.db');
  const hasExistingDb = fs.existsSync(dbPath);
  logger.debug(`${hasExistingDb ? 'Existing' : 'No Existing'} DB at ${dbPath}`);

  const orm = await MikroORM.init<BetterSqliteDriver>({
    dbName: dbPath,
    baseDir: __dirname,
    entities: ['../build/dao/entities'], // path to our JS entities (dist), relative to `baseDir`
    entitiesTs: ['./entities'], // path to our TS entities (src), relative to `baseDir`
    debug: !!process.env['DATABASE_DEBUG_LOGGING'],
    namingStrategy: UnderscoreNamingStrategy,
    forceUndefined: true,
  });

  // First launch
  if (!hasExistingDb) {
    logger.debug('Synchronizing DB');
    await orm.getSchemaGenerator().createSchema();
  }

  return orm;
});

export type EntityManager = SqlEntityManager<BetterSqliteDriver>;

export async function withDb<T>(
  f: (db: EntityManager) => Promise<T>,
  options?: CreateContextOptions,
  fork?: boolean,
): Promise<T> {
  const scopedEm = RequestContext.getEntityManager();
  if (!isUndefined(scopedEm)) {
    const manager = scopedEm as EntityManager;
    return f(fork ? manager.fork() : manager);
  } else {
    const orm = await initOrm();
    return RequestContext.create(
      fork ? orm.em.fork() : orm.em,
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      () => {
        return f(RequestContext.getEntityManager()! as EntityManager);
      },
      options,
    );
  }
}

export function getEm() {
  const em = RequestContext.getEntityManager();
  if (!em) throw new Error('EntityManager was not bound in this context');
  return em as EntityManager;
}
