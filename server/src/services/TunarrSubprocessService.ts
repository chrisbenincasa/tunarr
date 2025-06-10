import { Worker, type WorkerOptions } from 'node:worker_threads';
import { isDev } from '../util/index.ts';

export class TunarrSubprocessService {
  static createWorker(opts: WorkerOptions = {}) {
    return new TsWorker(process.argv[1], {
      ...opts,
      argv: ['--hide_banner', 'start-worker'],
    });
  }
}

class TsWorker extends Worker {
  constructor(filename: string, options: WorkerOptions = {}) {
    if (isDev) {
      options.workerData ??= {};
      // options.workerData.__ts_worker_filename = filename.toString();
      // super(new URL('./worker.mjs', import.meta.url), options);
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
