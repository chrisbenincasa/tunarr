import { injectable } from 'inversify';
import type { ITimer } from '../interfaces/ITimer.ts';
import { InjectLogger } from './inject.ts';
import type { LogLevels, Logger } from './logging/LoggerFactory.ts';
import { timeNamedAsync, timeNamedSync } from './perf.ts';

@injectable()
export class Timer implements ITimer {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(private defaultLevel: LogLevels = 'debug') {}

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
