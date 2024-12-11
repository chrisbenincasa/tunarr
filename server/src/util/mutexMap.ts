import { Mutex, MutexInterface, withTimeout } from 'async-mutex';
import { isDefined } from './index.ts';

/**
 * A class that handles creating/distributing mutexes associated with
 * a particular keyspace. Useful for initializing global cache objects
 * in an async environment
 */
export class MutexMap<Key extends string = string> {
  #mu = new Mutex();
  #keyedLocks: Map<Key, MutexInterface> = new Map();

  constructor(private timeout?: number) {}

  async getOrCreateLock(id: Key) {
    return await this.#mu.runExclusive(() => {
      let lock = this.#keyedLocks.get(id);
      if (!lock) {
        this.#keyedLocks.set(
          id,
          (lock = isDefined(this.timeout)
            ? withTimeout(new Mutex(), this.timeout)
            : new Mutex()),
        );
      }
      return lock;
    });
  }

  async runWithLockId<T>(id: Key, cb: () => Promise<T>): Promise<T> {
    return (await this.getOrCreateLock(id)).runExclusive(cb);
  }
}
