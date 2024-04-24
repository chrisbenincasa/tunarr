import { v4 } from 'uuid';
import { serverOptions, setServerOptions } from '../src/globals.js';
import { initServer } from '../src/server.js';
import { initTestDb } from './testDb.js';

export async function initTestApp(port: number) {
  setServerOptions({
    databaseDirectory: `/tmp/test_${v4()}`,
    force_migration: false,
    log_level: 'info',
    port,
    printRoutes: false,
  });

  // this will create all the ORM services and cache them
  await initTestDb();

  // create the schema so we can use the database
  // await orm.schema.createSchema();

  const { app } = await initServer(serverOptions());

  return app;
}
