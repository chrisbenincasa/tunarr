import dayjs from 'dayjs';
import { isUndefined } from 'lodash-es';
import type { Adapter } from 'lowdb';

/**
 * Caches writes in-memory and flushes to fs periodically. Safe for
 * ephemeral data / things where can filesystem and in-process can
 * safely go out of sync.
 */
export class InMemoryCachedDbAdapter<T> implements Adapter<T> {
  #underlying: Adapter<T>;
  #cached: T | null;
  #lastFlushTime: number = -1;

  constructor(underlying: Adapter<T>) {
    this.#underlying = underlying;
  }

  async read() {
    if (isUndefined(this.#cached)) {
      this.#cached = await this.#underlying.read();
    }
    return this.#cached;
  }

  async write(data: T): Promise<void> {
    const now = +dayjs();
    // Start with 30 second flush interval
    this.#cached = data;
    if (this.#lastFlushTime < 0 || now - this.#lastFlushTime > 30 * 1000) {
      this.#lastFlushTime = now;
      await this.#underlying.write(data);
    }
  }
}
