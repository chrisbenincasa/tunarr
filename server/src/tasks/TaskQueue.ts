import PQueue, { Options, Queue, QueueAddOptions } from 'p-queue';
import { Task } from './Task.js';
import { Maybe } from '../types/util.js';
import { Logger, LoggerFactory } from '../util/logging/LoggerFactory.js';

export class TaskQueue {
  #logger: Logger;
  #queue: PQueue;

  constructor(
    name: string,
    opts: Options<
      Queue<() => Promise<unknown>, QueueAddOptions>,
      QueueAddOptions
    > = {
      concurrency: 2,
    },
  ) {
    this.#logger = LoggerFactory.child({ caller: import.meta, queue: name });
    this.#queue = new PQueue({ ...opts });
  }

  async add<Out = unknown>(task: Task<Out>): Promise<Maybe<Out>> {
    try {
      this.#logger.trace('Adding task %s to queue', task.taskName);
      return await this.#queue.add(
        () => {
          return task.run();
        },
        { throwOnTimeout: true },
      );
    } catch (e) {
      this.#logger.error(e);
      return;
    }
  }

  set concurrency(c: number) {
    this.#queue.concurrency = c;
  }

  pause() {
    this.#queue.pause();
  }

  resume() {
    this.#queue.start();
  }
}

export const PlexTaskQueue = new TaskQueue('PlexTaskQueue', {
  concurrency: 2,
  intervalCap: 5,
  interval: 2000,
});
