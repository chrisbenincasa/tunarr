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
import { timeoutPromise } from '../util/index.ts';
import { InjectLogger } from '../util/inject.ts';
import { Logger } from '../util/logging/LoggerFactory.ts';
import { TunarrSubprocessService } from './TunarrSubprocessService.ts';

const MAX_WORKERS = 8;

const cpuCount = cpus().length;

const envVarSetting = getNumericEnvVar(WORKER_POOL_SIZE_ENV_VAR);

const numWorkers = envVarSetting ?? Math.min(cpuCount, MAX_WORKERS);

// A worker that dies is respawned, but a worker that cannot start at all —
// a broken bundle, a bad entry path — would otherwise be respawned in a tight
// loop forever. Back off, and give up rather than spin.
const MAX_CONSECUTIVE_RESTARTS = 5;
const RESTART_BACKOFF_MS = 1_000;
const MAX_RESTART_BACKOFF_MS = 30_000;

interface PooledWorker {
  worker: Worker;
  ready: boolean;
}

class Future<T> implements Promise<T> {
  #promise: Promise<T>;
  #resolve!: (v: T | PromiseLike<T>) => void;
  #reject!: (reason?: unknown) => void;
  #state: 'pending' | 'fulfilled' | 'rejected' = 'pending';
  #value: T | undefined;
  #err: unknown;

  constructor() {
    this.#promise = new Promise<T>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });

    this.#promise.then(
      (v) => {
        this.#state = 'fulfilled';
        this.#value = v;
      },
      (err) => {
        this.#state = 'rejected';
        this.#err = err;
      },
    );
  }

  [Symbol.toStringTag]!: string;

  resolve(value: T | PromiseLike<T>) {
    if (this.#state === 'pending') {
      this.#resolve(value);
    } else {
      throw new Error(
        'Resolving already fulfilled future with state ' + this.#state,
      );
    }
  }

  reject(e: unknown) {
    if (this.#state === 'pending') {
      this.#reject(e);
    } else {
      throw new Error(
        'Rejecting already fulfilled future with state ' + this.#state,
      );
    }
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.#promise.then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<T | TResult> {
    return this.#promise.catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.#promise.finally(onfinally);
  }

  get promise() {
    return this.#promise;
  }

  get state() {
    return this.#state;
  }

  get value() {
    return this.#value;
  }

  get error() {
    return this.#err;
  }
}

type State = 'pending' | 'starting' | 'started' | 'terminating';

@injectable()
export class TunarrWorkerPool implements IWorkerPool {
  #mu = new Mutex();
  #state: State = 'pending';
  #pool: (PooledWorker | undefined)[] = Array<PooledWorker | undefined>(
    numWorkers,
  ).fill(undefined);
  #consecutiveRestarts: number[] = Array<number>(numWorkers).fill(0);
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
    // Not 'pending' — that is the value just tested for, so assigning it back
    // left the guard inert and the "already starting" state unreachable. The
    // pool only reached 'started' an await boundary later, and a second
    // start() inside that window built an entire second set of workers over
    // the first: the originals were orphaned while queueTask round-robined
    // over a half-replaced pool.
    this.#state = 'starting';
    this.logger.info('Starting worker pool...');
    // Replaced rather than appended to. Pushing meant a pool restarted after
    // a shutdown kept the previous run's promises, so allReady() awaited —
    // and re-threw for — workers that had already been terminated.
    const startPromises = new Array<Promise<boolean>>();
    for (let i = 0; i < numWorkers; i++) {
      startPromises.push(this.setupWorker(i));
    }
    this.#startPromises = startPromises;
    Promise.all(startPromises)
      .then(() => {
        this.logger.debug(
          'Worker pool successfully started %d workers',
          numWorkers,
        );
        this.#state = 'started';
      })
      .catch((err: unknown) => {
        // Deliberately not reset to 'pending'. Some workers may have come up,
        // and a second start() over them would orphan those. shutdown() is
        // the defined way back to a startable state.
        this.logger.error(
          err,
          'Worker pool failed to start all %d workers',
          numWorkers,
        );
      });
  }

  async shutdown(timeout: number = 5_000) {
    if (this.#state === 'terminating') {
      return;
    }
    this.#state = 'terminating';
    this.logger.info('Attempting graceful shutdown of all workers');
    const shutdownPromises = this.#pool.map((pooled) =>
      pooled ? pooled.worker.terminate() : Promise.resolve(0),
    );
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
        const pooled = this.#pool[idx];
        this.#last = (this.#last + 1) % this.#pool.length;
        if (pooled === undefined) {
          throw new Error(`Worker at ${idx} has not been created yet`);
        }
        const { ready, worker } = pooled;
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
          this.#consecutiveRestarts[idx] = 0;
          const pooled = this.#pool[idx];
          if (pooled) {
            pooled.ready = true;
          }
          fut.resolve();
        })
        .with({ type: P.union('success', 'error') }, (reply) => {
          this.logger.debug(
            'Request id %s took %d ms',
            reply.requestId,
            this.consumeRequestTiming(reply.requestId),
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
      this.#pool[idx] = undefined;
      this.scheduleRestart(idx, code);

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
    });

    await fut;
    return true;
  }

  /**
   * Respawns a dead worker with exponential backoff, giving up after repeated
   * immediate failures.
   *
   * Without the backoff a worker that cannot start at all — a bad entry path in
   * a bundled build, say — is respawned as fast as the process can fork,
   * saturating a core and flooding the log.
   */
  private scheduleRestart(idx: number, exitCode: number) {
    if (this.#state === 'terminating') {
      this.logger.debug('Worker %d exited during shutdown.', idx);
      return;
    }

    const attempts = (this.#consecutiveRestarts[idx] ?? 0) + 1;
    this.#consecutiveRestarts[idx] = attempts;

    if (attempts > MAX_CONSECUTIVE_RESTARTS) {
      this.logger.error(
        'Worker %d exited (code = %d) and failed to start %d times in a row. Giving up on this worker.',
        idx,
        exitCode,
        MAX_CONSECUTIVE_RESTARTS,
      );
      return;
    }

    const delay = Math.min(
      RESTART_BACKOFF_MS * Math.pow(2, attempts - 1),
      MAX_RESTART_BACKOFF_MS,
    );

    this.logger.warn(
      'Worker %d exited (code = %d). Restarting in %d ms (attempt %d/%d).',
      idx,
      exitCode,
      delay,
      attempts,
      MAX_CONSECUTIVE_RESTARTS,
    );

    setTimeout(() => {
      if (this.#state === 'terminating') {
        return;
      }
      this.setupWorker(idx).catch((err) => {
        this.logger.error(err, 'Failed to restart worker %d', idx);
      });
    }, delay).unref();
  }

  /**
   * Returns how long a request took and clears its marks.
   *
   * Performance marks live on the global timeline until they are cleared, so
   * leaving one behind per request leaks for as long as the server runs.
   */
  private consumeRequestTiming(requestId: string): number {
    const [mark] = performance.getEntriesByName(requestId, 'mark');
    const duration = mark ? performance.now() - mark.startTime : 0;
    performance.clearMarks(requestId);
    return Math.round(duration);
  }
}
