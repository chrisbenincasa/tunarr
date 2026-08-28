import { isError, isString } from 'lodash-es';
import { WrappedError } from '../types/errors.ts';
import { Result } from '../types/result.ts';
import { wait } from './index.js';
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
  type PoolResult = Result<WithInput<R, T>, ErrorWithInput<T>>;

  // Settled tasks buffer their outcome here rather than being observed via
  // Promise.race. Racing only ever surfaces a single winner, so every other
  // task that settled in the same tick had its result discarded — with a
  // synchronously-resolving iteratorFn that dropped all but 1 in
  // `concurrency` results.
  // A non-positive limit would spin the producer loop with nothing in flight
  // and no await to yield on, starving the event loop entirely.
  const concurrency = Math.max(1, opts.concurrency);
  const completed: PoolResult[] = [];
  let running = 0;
  let onSettled: (() => void) | undefined;

  const start = (item: T) => {
    running++;
    void (async () => {
      try {
        const result = await iteratorFn(item, iterable);
        if (opts.waitAfterEachMs && opts.waitAfterEachMs > 0) {
          await wait(opts.waitAfterEachMs);
        } else if (opts.flushAfterEach) {
          await wait();
        }
        completed.push(Result.success({ result, input: item }));
      } catch (e) {
        let error: Error;
        if (isError(e)) {
          error = e;
        } else if (isString(e)) {
          error = new Error(e);
        } else {
          error = new Error(JSON.stringify(e));
        }

        completed.push(Result.failure(new ErrorWithInput(error, item)));
      } finally {
        running--;
        const notify = onSettled;
        onSettled = undefined;
        notify?.();
      }
    })();
  };

  // Hands back everything buffered so far, waiting for at least one task to
  // settle if nothing is buffered yet.
  async function* drain(): AsyncGenerator<PoolResult> {
    if (completed.length === 0 && running > 0) {
      await new Promise<void>((resolve) => {
        onSettled = resolve;
      });
    }

    for (
      let next = completed.shift();
      next !== undefined;
      next = completed.shift()
    ) {
      yield next;
    }
  }

  for (const item of iterable) {
    start(item);
    while (running >= concurrency) {
      yield* drain();
    }
  }

  while (running > 0 || completed.length > 0) {
    yield* drain();
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
