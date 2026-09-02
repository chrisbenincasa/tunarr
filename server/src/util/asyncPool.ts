import { isError, isString, sortBy } from 'lodash-es';
import { WrappedError } from '../types/errors.ts';
import { Result } from '../types/result.ts';
import { wait } from './index.js';

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

  // A non-positive limit would spin the producer loop with nothing in flight
  // and no await to yield on, starving the event loop entirely.
  const concurrency = Math.max(1, opts.concurrency);

  // Settled tasks buffer their outcome here rather than being observed via
  // Promise.race. Racing only ever surfaces a single winner, so every other
  // task that settled in the same tick had its result discarded — with a
  // synchronously-resolving iteratorFn that dropped all but 1 in
  // `concurrency` results.
  const completed: PoolResult[] = [];
  let running = 0;
  let onSettled: (() => void) | undefined;

  const start = (item: T, index: number) => {
    running++;
    void (async () => {
      try {
        const result = await iteratorFn(item, iterable);
        if (opts.waitAfterEachMs && opts.waitAfterEachMs > 0) {
          await wait(opts.waitAfterEachMs);
        } else if (opts.flushAfterEach) {
          await wait();
        }
        completed.push(Result.success({ result, input: item, index }));
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

  let index = 0;
  for (const item of iterable) {
    start(item, index++);
    while (running >= concurrency) {
      yield* drain();
    }
  }

  while (running > 0 || completed.length > 0) {
    yield* drain();
  }
}

// Collects an entire pool into an array. Rejects if any task failed: a short
// array is indistinguishable from a genuinely short one, and callers such as
// custom show sync overwrite their contents with whatever comes back, so a
// swallowed failure silently destroys programming. Callers that want to
// tolerate individual failures should iterate the pool directly.
export async function unfurlPool<T, R>(
  poolGen: AsyncGenerator<Result<WithInput<R, T>, ErrorWithInput<T>>>,
) {
  const collected: WithInput<R, T>[] = [];
  const failures: ErrorWithInput<T>[] = [];
  let total = 0;

  for await (const result of poolGen) {
    total++;
    if (result.isFailure()) {
      failures.push(result.error);
    } else {
      collected.push(result.get());
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `${failures.length} of ${total} async pool task(s) failed`,
    );
  }

  return sortBy(collected, (item) => item.index).map((item) => item.result);
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
  // Position of `input` in the source iterable. Results are yielded in
  // completion order; this is what lets a caller recover the input order.
  index: number;
};

// type Result<In, R> = Success<R, In> | Failure<In>;
