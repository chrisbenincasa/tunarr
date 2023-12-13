import type {
  BetterSqliteDriver,
  SqlEntityManager,
} from '@mikro-orm/better-sqlite'; // or any other driver package
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

// Temporary
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const initOrm = once(async () => {
  const orm = await MikroORM.init<BetterSqliteDriver>({
    dbName: path.resolve(globalOptions().database, 'db.db'),
    baseDir: __dirname,
    entities: ['../build/dao/entities'], // path to our JS entities (dist), relative to `baseDir`
    entitiesTs: ['./entities'], // path to our TS entities (src), relative to `baseDir`
    debug: !!process.env['DATABASE_DEBUG_LOGGING'],
    namingStrategy: UnderscoreNamingStrategy,
  });
  return orm;
});

export type EntityManager = SqlEntityManager<BetterSqliteDriver>;

export async function withDb<T>(
  f: (db: EntityManager) => Promise<T>,
  options?: CreateContextOptions,
): Promise<T> {
  const scopedEm = RequestContext.getEntityManager();
  if (!isUndefined(scopedEm)) {
    return f(scopedEm as EntityManager);
  } else {
    const orm = await initOrm();
    return RequestContext.createAsync(
      orm.em,
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
