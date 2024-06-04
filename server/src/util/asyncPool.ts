import { wait } from './index.js';

type AsyncPoolOpts = {
  concurrency: number;
  waitAfterEachMs?: number;
};

// Based on https://github.com/rxaviers/async-pool
// Notable changes:
// 1. Types
// 2. Single failed promise doesn't abort the whole operation
export async function* asyncPool<T, R>(
  iterable: Iterable<T>,
  iteratorFn: (item: T, iterable: Iterable<T>) => PromiseLike<R> | R,
  opts: AsyncPoolOpts,
): AsyncGenerator<Result<T, R>> {
  const executing = new Set<Promise<readonly [T, Awaited<R>]>>();

  async function consume() {
    try {
      const [, result] = await Promise.race(executing);
      return {
        type: 'success' as const,
        result,
      };
    } catch (e) {
      return e as Failure<T>;
    }
  }

  for (const item of iterable) {
    // Wrap iteratorFn() in an async fn to ensure we get a promise.
    // Then expose such promise, so it's possible to later reference and
    // remove it from the executing pool.
    const promise = (async () => {
      try {
        const r = await iteratorFn(item, iterable);
        if (opts.waitAfterEachMs && opts.waitAfterEachMs > 0) {
          await wait(opts.waitAfterEachMs);
        }
        return [item, r] as const;
      } catch (e) {
        throw {
          type: 'failure',
          error: e as unknown,
          input: item,
        };
      }
    })().finally(() => executing.delete(promise));

    executing.add(promise);
    if (executing.size >= opts.concurrency) {
      yield await consume();
    }
  }

  while (executing.size) {
    yield await consume();
  }
}

type Failure<In> = {
  type: 'error';
  error: unknown;
  input: In;
};

type Success<R> = {
  type: 'success';
  result: R;
};

type Result<In, R> = Success<R> | Failure<In>;
