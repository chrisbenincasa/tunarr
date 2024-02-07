import { cpus } from 'os';
import PQueue from 'p-queue';
import { Worker } from 'worker_threads';

const queue = new PQueue({ concurrency: cpus().length });

export function runWorker<T>(
  filenameWithoutExtension: URL,
  workerData?: unknown,
): Promise<T> {
  return queue.add<T>(
    async () => {
      const worker =
        process.env.NODE_ENV !== 'production'
          ? new Worker(new URL(`${filenameWithoutExtension.toString()}.ts`), {
              workerData,
              execArgv: ['--loader', 'ts-node/esm/transpile-only'],
            })
          : new Worker(new URL(`${filenameWithoutExtension.toString()}.js`), {
              workerData,
            });

      const result = await new Promise<T>((resolve, reject) => {
        worker.on('message', resolve);
        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) {
            reject(new Error(`Worker stopped with exit code ${code}`));
          }
        });
      });

      return result;
    },
    { throwOnTimeout: true },
  );
}
