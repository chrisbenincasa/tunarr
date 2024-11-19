import { Maybe } from '@/types/util.js';
import { Logger, LoggerFactory } from '@/util/logging/LoggerFactory.js';
import PQueue, { Options, Queue, QueueAddOptions } from 'p-queue';
import { v4 } from 'uuid';
import { AnonymousTask, Task } from './Task.js';

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
    this.#logger = LoggerFactory.child({
      caller: import.meta,
      queue: name,
      className: this.constructor.name,
    });
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

  async addFunc<Out = unknown>(
    name: string,
    func: () => Promise<Out>,
  ): Promise<Maybe<Out>> {
    return this.add(AnonymousTask(`${v4()}_${name}`, func));
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

export const JellyfinTaskQueue = new TaskQueue('JellyfinTaskQueue', {
  concurrency: 2,
  intervalCap: 5,
  interval: 2000,
});

export const DatabaseTaskQueue = new TaskQueue('DatabaseTaskQueue', {
  concurrency: 5,
  intervalCap: 10,
  interval: 1000,
});
