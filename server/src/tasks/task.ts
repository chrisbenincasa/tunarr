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
    logger.info('Running task ' + this.constructor.name);
    try {
      this.result = await this.runInternal();
    } catch (e) {
      logger.error('Task failed...');
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
