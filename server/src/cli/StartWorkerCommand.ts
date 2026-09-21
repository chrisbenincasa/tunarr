import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { CommandModule } from 'yargs';
import { container } from '../container.ts';
import type { ServerOptions } from '../globals.ts';
import { setServerOptionsUnchecked } from '../globals.ts';
import { MeilisearchService } from '../services/MeilisearchService.ts';
import { TunarrWorker } from '../services/TunarrWorker.ts';
import type { GenerateOpenApiCommandArgs } from './GenerateOpenApiCommand.ts';
import type { GlobalArgsType } from './types.ts';

type WorkerData = {
  serverOptions: ServerOptions;
};

export const StartWorkerCommand: CommandModule<
  GlobalArgsType,
  GenerateOpenApiCommandArgs
> = {
  command: 'start-worker',
  describe: 'Starts a Tunarr worker (internal use only)',
  handler: async () => {
    if (isMainThread) {
      console.error('This module is only meant to be run as a worker thread.');
      process.exit(1);
    }

    if (!parentPort) {
      console.error('No parent port.');
      process.exit(1);
    }

    const { serverOptions } = workerData as WorkerData;

    // The global options were already resolved from this worker's argv by the
    // CLI middleware. This applies the server-only fields on top — notably
    // searchPort, without which the worker starts hunting for a free port and
    // never finds the search server the parent is actually running.
    //
    // The unchecked setter is required: `setServerOptions` is `once()`-guarded
    // and the middleware has already spent it.
    setServerOptionsUnchecked(serverOptions);

    // A worker is not a server. It does not migrate the database, generate the
    // guide, run fixers, register cron jobs or refresh libraries — the parent
    // did all of that before spawning it, and doing it again once per worker
    // means N concurrent migrations against one SQLite file. The search client
    // is the one piece of shared startup a worker genuinely needs, because slot
    // scheduling resolves smart collections through it.
    await container.get<MeilisearchService>(MeilisearchService).start();

    container.get<TunarrWorker>(TunarrWorker).start();
  },
};
