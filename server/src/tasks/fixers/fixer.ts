import { RootLogger } from '../../util/logging/LoggerFactory.js';

export default abstract class Fixer {
  // False if the fixed data isn't required for proper server functioning
  canRunInBackground: boolean = false;

  async run() {
    try {
      return this.runInternal();
    } catch (e) {
      RootLogger.debug(e, 'Error when running fixer %s', this.constructor.name);
    }
  }

  protected abstract runInternal(): Promise<void>;
}
