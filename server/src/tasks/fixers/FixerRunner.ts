import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable, multiInject } from 'inversify';
import { find, round } from 'lodash-es';
import { SimpleStartupTask } from '../../services/startup/IStartupTask.ts';
import { ScheduleJobsStartupTask } from '../../services/startup/ScheduleJobsStartupTask.ts';
import Fixer from './fixer.js';

@injectable()
export class FixerRunner extends SimpleStartupTask {
  id = FixerRunner.name;
  dependencies = [ScheduleJobsStartupTask.name];

  constructor(
    @multiInject(KEYS.Fixer) private fixers: Fixer[],
    @inject(KEYS.Logger) private logger: Logger,
  ) {
    super();
  }

  getPromise(): Promise<void> {
    return this.runFixers();
  }

  async runFixers() {
    // Run all fixers one-off, swallowing all errors.
    // Fixers currently do not keep any state and we will
    // just run them at each server start. As such, they
    // should be idempotent.
    // Maybe one day we'll import these all dynamically and run
    // them, but not today.
    for (const fixer of this.fixers) {
      const name = fixer.constructor.name;
      const start = performance.now();
      try {
        const fixerPromise = fixer.run();
        if (!fixer.canRunInBackground) {
          await fixerPromise;
          this.logFixerSuccess(name, performance.now() - start);
        } else {
          fixerPromise
            .then(() => {
              this.logFixerSuccess(name, performance.now() - start);
            })
            .catch((e) => {
              this.logFixerError(name, e, performance.now() - start);
            });
        }
      } catch (e) {
        this.logFixerError(name, e, performance.now() - start);
      }
    }
  }

  getFixerByName(name: string): Maybe<Fixer> {
    return find(this.fixers, (fixer) => fixer.constructor.name === name);
  }

  private logFixerSuccess(fixer: string, duration: number) {
    this.logger.debug(
      'Fixer %s completed successfully (%d ms)',
      fixer,
      round(duration, 2),
    );
  }

  private logFixerError(fixer: string, error: unknown, duration: number) {
    this.logger.error(
      error,
      'Fixer %s failed to run (%d ms)',
      fixer,
      round(duration, 2),
    );
  }
}
