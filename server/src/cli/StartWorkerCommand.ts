import { isMainThread, parentPort } from 'node:worker_threads';
import type { CommandModule } from 'yargs';
import { container } from '../container.ts';
import { TunarrWorker } from '../services/TunarrWorker.ts';
import type { GenerateOpenApiCommandArgs } from './GenerateOpenApiCommand.ts';
import type { GlobalArgsType } from './types.ts';

export const StartWorkerCommand: CommandModule<
  GlobalArgsType,
  GenerateOpenApiCommandArgs
> = {
  command: 'start-worker',
  describe: 'Starts a Tunarr worker (internal use only)',
  // eslint-disable-next-line @typescript-eslint/require-await
  handler: async () => {
    if (isMainThread) {
      console.error('This module is only meant to be run as a worker thread.');
      process.exit(1);
    }

    if (!parentPort) {
      console.error('No parent port.');
      process.exit(1);
    }

    container.get<TunarrWorker>(TunarrWorker).start();
  },
};
