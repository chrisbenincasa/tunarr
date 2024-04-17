import { initOrm } from '../src/dao/dataSource.js';
import { initServer } from '../src/server.js';
import config from '../mikro-orm.config.js';
import { serverOptions, setServerOptions } from '../src/globals.js';
import { v4 } from 'uuid';

export async function initTestApp(port: number) {
  setServerOptions({
    databaseDirectory: `/tmp/test_${v4()}`,
    force_migration: false,
    log_level: 'info',
    port,
    printRoutes: false,
  });

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

  // create the schema so we can use the database
  // await orm.schema.createSchema();

  const { app } = await initServer(serverOptions());

  return app;
}
