import type { Logger } from '@/util/logging/LoggerFactory.js';

export default abstract class Fixer {
  protected abstract logger: Logger;

  // False if the fixed data isn't required for proper server functioning
  canRunInBackground: boolean = false;

  async run() {
    try {
      this.logger.debug('Running fixer %s', this.constructor.name);
      return this.runInternal();
    } catch (e) {
      this.logger.debug(
        e,
        'Error when running fixer %s',
        this.constructor.name,
      );
    }
  }

  protected abstract runInternal(): Promise<void>;
}
