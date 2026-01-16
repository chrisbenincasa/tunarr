import { LoggerFactory } from '../util/logging/LoggerFactory.ts';
import { SimpleTask } from './Task.ts';
import { simpleTaskDef } from './TaskRegistry.ts';

@simpleTaskDef()
export class RollLogFileTask extends SimpleTask {
  public ID: string = RollLogFileTask.name;
  protected runInternal(): Promise<void> {
    try {
      LoggerFactory.rollLogsNow();
    } catch (e) {
      this.logger.error(e, 'Error rolling logs');
    }
    return Promise.resolve();
  }
}
