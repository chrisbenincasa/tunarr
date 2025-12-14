import { injectable } from 'inversify';
import { Worker, type WorkerOptions } from 'node:worker_threads';
import { container } from '../container.ts';
import { serverOptions } from '../globals.ts';
import { isDev } from '../util/index.ts';
import { MeilisearchService } from './MeilisearchService.ts';

@injectable()
export class TunarrSubprocessService {
  constructor() {}

  createWorker(opts: WorkerOptions = {}) {
    return new TsWorker(process.argv[1]!, {
      ...opts,
      argv: ['--hide_banner', 'start-worker'],
    });
  }
}

class TsWorker extends Worker {
  constructor(filename: string, options: WorkerOptions = {}) {
    options.workerData ??= {
      serverOptions: {
        ...serverOptions(),
        searchPort: container
          .get<MeilisearchService>(MeilisearchService)
          .getPort(),
      },
    };

    if (isDev) {
      super(
        `import('tsx/esm/api').then(({ register }) => { register(); import('${new URL(filename, import.meta.url).toString()}') })`,
        {
          ...options,
          eval: true,
        },
      );
    } else {
      super(new URL(filename, import.meta.url), options);
    }
  }
}
