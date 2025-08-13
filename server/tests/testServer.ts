import tmp from 'tmp-promise';
import { bootstrapTunarr } from '../src/bootstrap.ts';
import { container } from '../src/container.ts';
import { setServerOptions } from '../src/globals.js';
import { Server } from '../src/Server.js';

// Make this a fixture
export let dbResult: tmp.DirectoryResult;

export async function initTestApp(port: number) {
  dbResult = await tmp.dir({ unsafeCleanup: true });
  setServerOptions({
    database: dbResult.path,
    force_migration: false,
    log_level: 'debug',
    verbose: 0,
    port,
    printRoutes: false,
    trustProxy: false,
  });
  await bootstrapTunarr();

  return await container.get(Server).runServer();
}
