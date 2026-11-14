import type Sqlite from 'better-sqlite3';
import { performance } from 'node:perf_hooks';

export type SlowQuery = {
  sql: string;
  durationMs: number;
  /** Stack frames of the code that ran the query, innermost first. */
  callStack: string[];
};

export type SlowQueryLogOptions = {
  thresholdMs: number;
  onSlowQuery: (query: SlowQuery) => void;
  now?: () => number;
};

type AnyFunction = (...args: never[]) => unknown;

const CallerFrameLimit = 20;

/**
 * Times every statement run through a better-sqlite3 connection and reports
 * the ones that reach `thresholdMs`. Kysely and Drizzle both prepare their
 * statements on the connection, so one wrapper covers both.
 *
 * better-sqlite3 runs queries synchronously, so a slow query blocks its
 * thread's event loop for its whole run. The report fires as the query
 * returns, while the caller's stack is still live.
 */
export function withSlowQueryLog(
  db: Sqlite.Database,
  opts: SlowQueryLogOptions,
): Sqlite.Database {
  const now = opts.now ?? (() => performance.now());

  function finish(sql: string, durationMs: number, caller?: AnyFunction) {
    if (durationMs < opts.thresholdMs) {
      return;
    }
    opts.onSlowQuery({
      sql,
      durationMs: Math.round(durationMs),
      callStack: captureCaller(caller),
    });
  }

  function* timeIterator<T>(
    iterator: IterableIterator<T>,
    sql: string,
  ): Generator<T, void, undefined> {
    let elapsed = 0;
    try {
      for (;;) {
        const startedAt = now();
        const next = iterator.next();
        elapsed += now() - startedAt;
        if (next.done) {
          return;
        }
        yield next.value;
      }
    } finally {
      // Closes the statement when the consumer stops early.
      iterator.return?.();
      finish(sql, elapsed);
    }
  }

  function timeStatement(stmt: Sqlite.Statement): Sqlite.Statement {
    const proxy: Sqlite.Statement = new Proxy(stmt, {
      get(target, prop) {
        const value: unknown = Reflect.get(target, prop, target);
        if (typeof value !== 'function') {
          return value;
        }

        switch (prop) {
          case 'run':
          case 'get':
          case 'all':
            return function timedStatement(...args: unknown[]): unknown {
              const startedAt = now();
              try {
                return value.apply(target, args);
              } finally {
                finish(target.source, now() - startedAt, timedStatement);
              }
            };
          case 'iterate':
            return (...args: unknown[]) =>
              timeIterator(target.iterate(...args), target.source);
        }

        // Chaining methods such as raw() and pluck() return the statement, so
        // hand back the proxy to keep timing the calls that follow.
        return (...args: unknown[]) => {
          const result: unknown = value.apply(target, args);
          return result === target ? proxy : result;
        };
      },
    });
    return proxy;
  }

  const proxy: Sqlite.Database = new Proxy(db, {
    get(target, prop) {
      const value: unknown = Reflect.get(target, prop, target);
      if (typeof value !== 'function') {
        return value;
      }

      switch (prop) {
        case 'prepare':
          return (source: string) => timeStatement(target.prepare(source));
        case 'exec':
          return function timedExec(source: string) {
            const startedAt = now();
            try {
              target.exec(source);
              return proxy;
            } finally {
              finish(source, now() - startedAt, timedExec);
            }
          };
      }

      return (...args: unknown[]) => {
        const result: unknown = value.apply(target, args);
        return result === target ? proxy : result;
      };
    },
  });
  return proxy;
}

function captureCaller(above?: AnyFunction): string[] {
  const holder: { stack?: string } = {};
  const limit = Error.stackTraceLimit;
  Error.stackTraceLimit = CallerFrameLimit;
  try {
    Error.captureStackTrace(holder, above);
  } finally {
    Error.stackTraceLimit = limit;
  }
  return (holder.stack ?? '')
    .split('\n')
    .slice(1)
    .map((frame) => frame.trim());
}
