import { inject, injectable } from 'inversify';
import type { ITimer } from '../interfaces/ITimer.ts';
import { KEYS } from '../types/inject.ts';
import type { LogLevels, Logger } from './logging/LoggerFactory.ts';
import { timeNamedAsync, timeNamedSync } from './perf.ts';

@injectable()
export class Timer implements ITimer {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    private defaultLevel: LogLevels = 'debug',
  ) {}

  timeSync<T>(
    name: string,
    f: () => T,
    opts: { level: LogLevels } = { level: this.defaultLevel },
  ): T {
    return timeNamedSync(name, this.logger, f, opts);
  }

  timeAsync<T>(
    name: string,
    f: () => Promise<T>,
    opts: { level: LogLevels } = { level: this.defaultLevel },
  ): Promise<T> {
    return timeNamedAsync(name, this.logger, f, opts);
  }
}
