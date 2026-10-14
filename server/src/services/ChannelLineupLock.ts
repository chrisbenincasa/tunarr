import { bindingScopeValues, injectable } from 'inversify';
import { AsyncLocalStorage } from 'node:async_hooks';
import { MutexMap } from '../util/mutexMap.ts';

/**
 * The one lock on a channel's lineup.
 *
 * Reading a lineup, building a new one and writing it back is not atomic:
 * `LineupRepository` only makes the file write itself atomic, so two
 * overlapping read-modify-writes lose one of the two results. Everything that
 * rewrites a single channel's lineup, `channel.duration` or `channel.startTime`
 * runs through here, including the on-demand cursor writes.
 *
 * It is reentrant per channel. A task can hold the lock and still call a
 * command that takes it -- the reconciler holds it while calling
 * `RegenerateChannelLineupCommand`, which a plain mutex would deadlock on.
 * Different channels never wait on each other.
 *
 * Singleton scope is load-bearing. A lock only serializes callers that share
 * it, and Inversify's default scope is Transient, so a per-injection-site
 * instance would lock a channel only against itself.
 */
@injectable(bindingScopeValues.Singleton)
export class ChannelLineupLock {
  #locks = new MutexMap();
  #held = new AsyncLocalStorage<ReadonlySet<string>>();

  run<T>(channelId: string, cb: () => Promise<T>): Promise<T> {
    const held = this.#held.getStore();
    if (held?.has(channelId)) {
      return cb();
    }

    const nested = new Set(held ?? []);
    nested.add(channelId);

    return this.#locks.runWithLockId(channelId, () =>
      this.#held.run(nested, cb),
    );
  }

  /**
   * Runs `cb` as if no lock were held.
   *
   * Reentrancy rides on an `AsyncLocalStorage`, which a timer or a callback
   * registered inside the critical section inherits and keeps after the lock
   * is released. Work scheduled for later goes through here so it waits for
   * the lock like any other caller instead of walking past it.
   */
  runDetached<T>(cb: () => T): T {
    return this.#held.exit(cb);
  }

  isLocked(channelId: string): boolean {
    return this.#locks.isLocked(channelId);
  }
}
