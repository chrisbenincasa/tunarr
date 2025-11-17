import { isError, isString } from 'lodash-es';
import { WrappedError } from '../types/errors.ts';
import { Result } from '../types/result.ts';
import { caughtErrorToError, wait } from './index.js';
import { LoggerFactory } from './logging/LoggerFactory.js';

type AsyncPoolOpts = {
  concurrency: number;
  waitAfterEachMs?: number;
  flushAfterEach?: boolean;
};

// Based on https://github.com/rxaviers/async-pool
// Notable changes:
// 1. Types
// 2. Single failed promise doesn't abort the whole operation
export async function* asyncPool<T, R>(
  iterable: Iterable<T>,
  iteratorFn: (item: T, iterable: Iterable<T>) => PromiseLike<R> | R,
  opts: AsyncPoolOpts,
): AsyncGenerator<Result<WithInput<R, T>, ErrorWithInput<T>>> {
  const executing = new Set<Promise<readonly [T, Awaited<R>]>>();

  async function consume(): Promise<
    Result<WithInput<R, T>, ErrorWithInput<T>>
  > {
    try {
      const [input, result] = await Promise.race(executing);
      return Result.success({
        result,
        input,
      });
    } catch (e) {
      return Result.failure(e as ErrorWithInput<T>);
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
        } else if (opts.flushAfterEach) {
          await wait();
        }
        return [item, r] as const;
      } catch (e) {
        let error: Error;
        if (isError(e)) {
          error = e;
        } else if (isString(e)) {
          error = new Error(e);
        } else {
          error = new Error(JSON.stringify(e));
        }

        throw new ErrorWithInput(error, item);
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

export async function* asyncPoolGen<T, R>(
  iterable: AsyncIterable<T>,
  iteratorFn: (item: T) => PromiseLike<R> | R,
  opts: AsyncPoolOpts,
): AsyncGenerator<Result<WithInput<R, T>, ErrorWithInput<T>>> {
  const executing = new Set<Promise<readonly [T, Awaited<R>]>>();

  async function consume(): Promise<
    Result<WithInput<R, T>, ErrorWithInput<T>>
  > {
    try {
      const [input, result] = await Promise.race(executing);
      return Result.success({
        result,
        input,
      });
    } catch (e) {
      return Result.failure(e as ErrorWithInput<T>);
    }
  }

  // TODO This doesn't work
  for await (const item of iterable) {
    // Wrap iteratorFn() in an async fn to ensure we get a promise.
    // Then expose such promise, so it's possible to later reference and
    // remove it from the executing pool.
    const promise = (async () => {
      try {
        const r = await iteratorFn(item);
        if (opts.waitAfterEachMs && opts.waitAfterEachMs > 0) {
          await wait(opts.waitAfterEachMs);
        }
        return [item, r] as const;
      } catch (e) {
        throw new ErrorWithInput(caughtErrorToError(e), item);
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

export async function unfurlPool<T, R>(
  poolGen: AsyncGenerator<Result<WithInput<R, T>, ErrorWithInput<T>>>,
) {
  const results: R[] = [];
  for await (const result of poolGen) {
    if (result.isFailure()) {
      LoggerFactory.root.error(
        result.error,
        'Error processing async pool task',
      );
    } else {
      results.push(result.get().result);
    }
  }
  return results;
}

class ErrorWithInput<In> extends WrappedError {
  constructor(
    root: Error,
    public input: In,
  ) {
    super(root?.message, { cause: root.cause });
  }
}

type WithInput<R, In> = {
  result: R;
  input: In;
};

// type Result<In, R> = Success<R, In> | Failure<In>;
