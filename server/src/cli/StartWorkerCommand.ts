import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import type { CommandModule } from 'yargs';
import { container } from '../container.ts';
import type { ServerOptions } from '../globals.ts';
import { setServerOptions } from '../globals.ts';
import { StartupService } from '../services/StartupService.ts';
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

    // TODO: parse
    const { serverOptions } = workerData as WorkerData;
    setServerOptions(serverOptions);

    await container.get<StartupService>(StartupService).runStartupServices();
    container.get<TunarrWorker>(TunarrWorker).start();
  },
};
