import { isError, round } from 'lodash-es';
import { attempt, attemptSync } from './index.ts';
import type { LogLevels, Logger } from './logging/LoggerFactory.ts';

export function time<T>(f: () => T): [T, number] {
  const start = performance.now();
  const res = f();
  const end = performance.now();
  return [res, end - start] as const;
}

export function timeSync<T>(
  f: () => T,
  cb: {
    onSuccess: (ms: number, d: T) => void;
    onFailure: (ms: number, e: Error) => void;
  },
) {
  const start = performance.now();
  const result = attemptSync(f);
  const end = performance.now();
  const error = isError(result);

  if (error) {
    cb.onFailure(end - start, result);
  } else {
    cb.onSuccess(end - start, result);
  }

  if (error) {
    throw result;
  }

  return result;
}

export async function timeAsync<T>(
  f: () => Promise<T>,
  cb: {
    onSuccess: (ms: number, d: T) => void;
    onFailure: (ms: number, e: unknown) => void;
  },
) {
  const start = performance.now();
  const result = await attempt(f);
  const end = performance.now();
  const error = isError(result);

  if (error) {
    cb.onFailure(end - start, result);
  } else {
    cb.onSuccess(end - start, result);
  }

  return error ? Promise.reject(result) : Promise.resolve(result);
}

export function timeNamedSync<T>(
  name: string,
  logger: Logger,
  f: () => T,
  opts: { level: LogLevels } = { level: 'debug' },
): T {
  return timeSync(f, {
    onSuccess(ms) {
      logger[opts.level]('%s took %dms (success)', name, round(ms, 3));
    },
    onFailure(ms) {
      logger[opts.level]('%s took %dms (failure)', name, round(ms, 3));
    },
  });
}

export function timeNamedAsync<T>(
  name: string,
  logger: Logger,
  f: () => Promise<T>,
  opts: { level: LogLevels } = { level: 'debug' },
): Promise<T> {
  return timeAsync(f, {
    onSuccess(ms) {
      logger[opts.level]('%s took %dms (success)', name, round(ms, 3));
    },
    onFailure(ms) {
      logger[opts.level]('%s took %dms (failure)', name, round(ms, 3));
    },
  });
}
