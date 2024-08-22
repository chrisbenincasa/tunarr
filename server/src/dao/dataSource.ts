import { dbOptions } from '@/globals.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type {
  EntityManager as BetterSqlite3EntityManager,
  Options,
} from '@mikro-orm/better-sqlite'; // or any other driver package
import { MikroORM } from '@mikro-orm/better-sqlite';
import { CreateContextOptions, RequestContext } from '@mikro-orm/core';
import { isUndefined, once } from 'lodash-es';
import fs from 'node:fs';
import 'reflect-metadata';

export type EntityManager = BetterSqlite3EntityManager;

export const initOrm = once(async (mikroOrmOptions?: Options) => {
  const logger = LoggerFactory.root;
  const opts = mikroOrmOptions ?? dbOptions();
  const hasExistingDb = fs.existsSync(opts.dbName!); // Fail fast.
  logger.debug(
    `${hasExistingDb ? 'Existing' : 'No Existing'} DB at ${opts.dbName}`,
  );

  const orm = await MikroORM.init(opts);

  const migrator = orm.getMigrator();

  if (
    !hasExistingDb ||
    (await migrator.checkMigrationNeeded()) ||
    (await migrator.getPendingMigrations()).length > 0
  ) {
    logger.debug('Synchronizing DB');
    await migrator.up();
  }

  return orm;
});

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
    return await RequestContext.create(
      orm.em.fork(),
      () => {
        return f(RequestContext.currentRequestContext()!.em as EntityManager);
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
