import { isError, isString, round } from 'lodash-es';
import createLogger from '../logger.js';
import { Maybe } from '../types.js';

const logger = createLogger(import.meta);

// Set of all of the possible Task IDs
export type TaskId = 'update-xmltv' | 'cleanup-sessions';

export abstract class Task<Data> {
  private running_ = false;

  protected hasRun: boolean = false;
  protected result: Maybe<Data>;

  public abstract ID: TaskId;

  protected abstract runInternal(): Promise<Maybe<Data>>;

  async run(): Promise<Maybe<Data>> {
    this.running_ = true;
    const start = performance.now();
    try {
      this.result = await this.runInternal();
      const duration = round(performance.now() - start, 2);
      logger.info('Task %s ran in %d ms', this.constructor.name, duration);
    } catch (e) {
      const error = isError(e) ? e : new Error(isString(e) ? e : 'Unknown');
      const duration = round(performance.now() - start, 2);
      logger.warn(
        'Task %s ran in %d ms and failed. Error = %O',
        this.constructor.name,
        duration,
        error,
      );
      return;
    } finally {
      this.hasRun = true;
      this.running_ = false;
    }

    return this.result;
  }

  getResult(): Maybe<Data> {
    return this.result;
  }

  get running() {
    return this.running_;
  }

  abstract get name(): string;
}
