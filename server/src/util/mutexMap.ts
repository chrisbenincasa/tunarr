import { Mutex, MutexInterface, withTimeout } from 'async-mutex';
import { injectable } from 'inversify';
import { Maybe } from '../types/util.ts';
import { isDefined } from './index.ts';

/**
 * A class that handles creating/distributing mutexes associated with
 * a particular keyspace. Useful for initializing global cache objects
 * in an async environment
 */
@injectable()
export class MutexMap {
  #mu = new Mutex();
  #keyedLocks: Record<string, MutexInterface> = {};

  constructor(private timeout?: number) {}

  async getOrCreateLock(id: string) {
    return await this.#mu.runExclusive(() => {
      let lock = this.#keyedLocks[id];
      if (!lock) {
        this.#keyedLocks[id] = lock = isDefined(this.timeout)
          ? withTimeout(new Mutex(), this.timeout)
          : new Mutex();
      }
      return lock;
    });
  }

  async runWithLockId<T>(id: string, cb: () => Promise<T>): Promise<T> {
    return (await this.getOrCreateLock(id)).runExclusive(cb);
  }

  getLockSync(id: string): Maybe<MutexInterface> {
    return this.#keyedLocks[id];
  }
}
