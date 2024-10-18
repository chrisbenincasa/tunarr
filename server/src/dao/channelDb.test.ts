import fs from 'fs/promises';
import { join } from 'path';
import temp from 'temp';
import config from '../../mikro-orm.config.js';
import { setGlobalOptions } from '../globals.js';
import { initOrm } from './dataSource.js';

beforeAll(async () => {
  temp.track();

  const database = await temp.mkdir();
  setGlobalOptions({
    databaseDirectory: database,
    force_migration: false,
    log_level: 'info',
  });

  await fs.mkdir(join(database, 'channel-lineups'));

  // this will create all the ORM services and cache them
  await initOrm({
    ...config,
    // no need for debug information, it would only pollute the logs
    debug: false,
    // we will use in-memory database, this way we can easily parallelize our tests
    dbName: ':memory:',
    // this will ensure the ORM discovers TS entities, with ts-node, ts-jest and vitest
    // it will be inferred automatically, but we are using vitest here
    // tsNode: true,
  });
});
