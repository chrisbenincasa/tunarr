import { Mutex } from 'async-mutex';
import retry from 'async-retry';
import { inject, injectable } from 'inversify';
import { reject } from 'lodash-es';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Worker } from 'node:worker_threads';
import { StrictOmit } from 'ts-essentials';
import { match, P } from 'ts-pattern';
import { v4 } from 'uuid';
import z from 'zod/v4';
import { IWorkerPool } from '../interfaces/IWorkerPool.ts';

import {
  WorkerMessage,
  WorkerRequest,
  WorkerRequestToResponse,
} from '../types/worker_schemas.ts';
import { getNumericEnvVar, WORKER_POOL_SIZE_ENV_VAR } from '../util/env.ts';
import { Future } from '../util/future.ts';
import { timeoutPromise } from '../util/index.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { TunarrSubprocessService } from './TunarrSubprocessService.ts';

const MAX_WORKERS = 8;

const cpuCount = cpus().length;

const envVarSetting = getNumericEnvVar(WORKER_POOL_SIZE_ENV_VAR);

const numWorkers = envVarSetting ?? Math.min(cpuCount, MAX_WORKERS);

interface PooledWorker {
  worker: Worker;
  ready: boolean;
}

type State = 'pending' | 'started' | 'terminating';

@injectable()
export class TunarrWorkerPool implements IWorkerPool {
  #mu = new Mutex();
  #state: State = 'pending';
  #pool: PooledWorker[] = Array<PooledWorker>(numWorkers);
  #last = 0;
  #listeners = new Map<string, Future<unknown>>();
  #outstandingByIndex = new Map<number, string[]>();
  #startPromises: Promise<boolean>[] = [];

  @InjectLogger() declare private readonly logger: Logger;

  constructor(
    @inject(TunarrSubprocessService)
    private subprocessService: TunarrSubprocessService,
  ) {}

  start() {
    if (this.#state !== 'pending') {
      return;
    }
    this.#state = 'pending';
    this.logger.info('Starting worker pool...');
    for (let i = 0; i < numWorkers; i++) {
      this.#startPromises.push(this.setupWorker(i));
    }
    Promise.all(this.#startPromises)
      .then(() => {
        this.logger.debug(
          'Worker pool successfully started %d workers',
          numWorkers,
        );
        this.#state = 'started';
      })
      .catch(console.error);
  }

  async shutdown(timeout: number = 5_000) {
    if (this.#state === 'terminating') {
      return;
    }
    this.#state = 'terminating';
    this.logger.info('Attempting graceful shutdown of all workers');
    const shutdownPromises = this.#pool.map(({ worker }) => {
      if (worker) {
        return worker.terminate();
      }
      return Promise.resolve();
    });
    return timeoutPromise(
      Promise.all(shutdownPromises).then(() => {}),
      timeout,
    ).then(() => {
      this.#state = 'pending';
    });
  }

  async allReady() {
    await Promise.all(this.#startPromises);
    return;
  }

  async queueTask<
    Req extends StrictOmit<WorkerRequest, 'requestId'>,
    Out = z.infer<(typeof WorkerRequestToResponse)[Req['type']]>,
  >(request: Req, timeout: number = 60_000): Promise<Out> {
    const requestId = v4();
    const reqWithId: WorkerRequest = { ...request, requestId };
    const fut = new Future<Out>();
    await retry(async () => {
      return this.#mu.runExclusive(() => {
        const idx = this.#last;
        const { ready, worker } = this.#pool[idx]!;
        this.#last = (this.#last + 1) % this.#pool.length;
        if (ready) {
          this.logger.debug(
            'Schedule task type "%s" to worker index %d [request id = %s]',
            request.type,
            idx,
            requestId,
          );
          this.#listeners.set(reqWithId.requestId, fut as Future<unknown>);
          this.#outstandingByIndex.set(
            idx,
            this.#outstandingByIndex.get(idx)?.concat([requestId]) ?? [
              requestId,
            ],
          );
          performance.mark(requestId);
          worker.postMessage(reqWithId);
          return;
        } else {
          throw new Error(`Worker at ${idx} is not ready yet`);
        }
      });
    });

    return timeoutPromise(fut.promise, timeout);
  }

  private async setupWorker(idx: number): Promise<boolean> {
    if (this.#state === 'terminating') {
      this.logger.trace('Not starting worker because pool is terminating.');
      return Promise.resolve(false);
    }

    this.logger.info(`Starting worker ${idx}`);
    const worker = this.subprocessService.createWorker();

    this.#pool[idx] = {
      worker,
      ready: false,
    };

    const fut = new Future<void>();
    let started = false;

    worker.on('message', (message) => {
      const parsed = WorkerMessage.safeParse(message);
      if (parsed.error) {
        this.logger.warn(
          'Worker responded with broken reply: %s',
          parsed.error.message,
        );
        return;
      }

      match(parsed.data)
        .with({ type: 'event', eventType: 'started' }, () => {
          // We should only ever get one of these
          this.logger.debug('Worker %d is ready', idx);
          started = true;
          fut.resolve();
          this.#pool[idx]!.ready = true;
        })
        .with({ type: P.union('success', 'error') }, (reply) => {
          performance.mark(reply.requestId);
          this.logger.debug(
            'Request id %s took %d ms',
            reply.requestId,
            performance.measure(reply.requestId).duration,
          );
          const fut = this.#listeners.get(reply.requestId);
          if (fut) {
            this.#listeners.delete(reply.requestId);
            this.#outstandingByIndex.set(
              idx,
              reject(
                this.#outstandingByIndex.get(idx),
                (id) => id === reply.requestId,
              ),
            );
            if (reply.type === 'success') {
              fut.resolve(reply.data);
            } else {
              fut.reject(new Error(reply.message));
            }
          } else {
            this.logger.error(
              'No listener found for request ID: %s',
              reply.requestId,
            );
          }
        })
        .exhaustive();
    });

    worker.on('error', (err) => {
      this.logger.error(err, 'Worker %d errored out', idx);
      if (!started) {
        fut.reject(err);
      }

      const outstandingListeners = this.#outstandingByIndex.get(idx) ?? [];
      for (const outstanding of outstandingListeners) {
        this.#listeners.get(outstanding)?.reject(err);
      }

      this.#outstandingByIndex.set(idx, []);
    });

    worker.on('exit', (code) => {
      this.#startPromises
        // eslint-disable-next-line no-unexpected-multiline
        [idx]!.then(() => this.setupWorker(idx))
        .catch(() => this.setupWorker(idx));

      const outstandingListeners = this.#outstandingByIndex.get(idx) ?? [];
      for (const outstanding of outstandingListeners) {
        const fut = this.#listeners.get(outstanding);
        if (fut?.state === 'pending') {
          fut.reject(new Error('Worker exited'));
        }
      }
      this.#outstandingByIndex.set(idx, []);

      if (!started && fut.state === 'pending' && code !== 0) {
        fut.reject(new Error('Worker exited with code ' + code));
      }
      this.logger.warn(
        'Worker %d exited (code = %d).%s',
        idx,
        code,
        this.#state === 'started' ? ' Restarting.' : '',
      );
    });

    await fut;
    return true;
  }
}
