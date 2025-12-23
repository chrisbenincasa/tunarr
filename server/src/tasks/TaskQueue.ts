import type { Maybe } from '@/types/util.js';
import type { Logger } from '@/util/logging/LoggerFactory.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import type { Options, Queue, QueueAddOptions } from 'p-queue';
import PQueue from 'p-queue';
import { v4 } from 'uuid';
import type { Task } from './Task.js';
import { AnonymousTask } from './Task.js';

export type TaskQueueFactory = ConstructorParameters<typeof TaskQueue>;

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

  async add<Args extends unknown[] = unknown[], Out = unknown>(
    task: Task<Args, Out>,
    ...args: Args
  ): Promise<Maybe<Out>> {
    try {
      this.#logger.trace('Adding task %s to queue', task.taskName);
      return await this.#queue.add(
        () => {
          return task.run(...args);
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
