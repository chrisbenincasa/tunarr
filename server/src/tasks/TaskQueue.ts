import PQueue, { Options, Queue, QueueAddOptions } from 'p-queue';
import { Task } from './Task.js';
import { Maybe } from '../types/util.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

export class TaskQueue {
  #logger = LoggerFactory.child({ caller: import.meta });
  #queue: PQueue;

  constructor(
    opts: Options<
      Queue<() => Promise<unknown>, QueueAddOptions>,
      QueueAddOptions
    > = {
      concurrency: 2,
    },
  ) {
    this.#queue = new PQueue({ ...opts });
  }

  async add<Out = unknown>(task: Task<Out>): Promise<Maybe<Out>> {
    try {
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
}

export const PlexTaskQueue = new TaskQueue();
