import tmp from 'tmp-promise';
import { bootstrapTunarr } from '../src/bootstrap.ts';
import { container } from '../src/container.ts';
import { setServerOptions } from '../src/globals.js';
import { Server } from '../src/Server.js';
import { copyPreMigratedDb } from '../src/testing/testDbFactory.ts';

// Make this a fixture
export let dbResult: tmp.DirectoryResult;

export async function initTestApp(port: number): Promise<Server> {
  dbResult = await tmp.dir({ unsafeCleanup: true });
  await copyPreMigratedDb(dbResult.path);
  setServerOptions({
    database: dbResult.path,
    log_level: 'debug',
    verbose: 0,
    port,
    printRoutes: false,
    trustProxy: false,
  });
  await bootstrapTunarr();

  return await container.get(Server).runServer();
}
