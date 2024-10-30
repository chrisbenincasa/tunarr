import type {
  EntityManager as BetterSqlite3EntityManager,
  Options,
} from '@mikro-orm/better-sqlite'; // or any other driver package
import { MikroORM } from '@mikro-orm/better-sqlite';
import fs from 'fs';
import { once } from 'lodash-es';
import 'reflect-metadata';
import { dbOptions } from '../globals.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

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
