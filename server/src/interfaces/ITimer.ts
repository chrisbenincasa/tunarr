import type { LogLevels } from '../util/logging/LoggerFactory.ts';

export interface ITimer {
  timeSync<T>(name: string, f: () => T, opts: { level: LogLevels }): T;

  timeAsync<T>(
    name: string,
    f: () => Promise<T>,
    opts: { level: LogLevels },
  ): Promise<T>;
}
