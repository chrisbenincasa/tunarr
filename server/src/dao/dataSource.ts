import type { EntityManager as BetterSqlite3EntityManager } from '@mikro-orm/better-sqlite'; // or any other driver package
import { MikroORM } from '@mikro-orm/better-sqlite';
import { CreateContextOptions, RequestContext } from '@mikro-orm/core';
import fs from 'fs';
import { isUndefined, once } from 'lodash-es';
import path from 'node:path';
import 'reflect-metadata';
import dbConfig from '../../mikro-orm.config.js';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';

const logger = createLogger(import.meta);

export type EntityManager = BetterSqlite3EntityManager;

export const initOrm = once(async () => {
  const dbPath = path.join(globalOptions().database, 'db.db');
  const hasExistingDb = fs.existsSync(dbPath);
  logger.debug(`${hasExistingDb ? 'Existing' : 'No Existing'} DB at ${dbPath}`);

  const orm = await MikroORM.init({
    ...dbConfig,
    dbName: dbPath,
  });

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
    if (fork) {
      return RequestContext.create(manager.fork(), f);
    } else {
      return f(manager);
    }
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
