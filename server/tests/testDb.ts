import config from '../mikro-orm.config.js';
import { initOrm } from '../src/dao/dataSource';

export async function initTestDb() {
  // this will create all the ORM services and cache them
  return await initOrm({
    ...config,
    // no need for debug information, it would only pollute the logs
    debug: false,
    // we will use in-memory database, this way we can easily parallelize our tests
    dbName: ':memory:',
    // this will ensure the ORM discovers TS entities, with ts-node, ts-jest and vitest
    // it will be inferred automatically, but we are using vitest here
    // tsNode: true,
  });
}
