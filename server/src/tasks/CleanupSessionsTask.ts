import { serverContext } from '@/serverContext.js';
import { Maybe } from '@/types/util.js';
import { Task, TaskId } from './Task.js';

export class CleanupSessionsTask extends Task<void> {
  public static ID: TaskId = 'cleanup-sessions';
  public ID = CleanupSessionsTask.ID;
  public static name = 'CleanupSessionsTask';

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<Maybe<void>> {
    serverContext().sessionManager.cleanupStaleSessions();
  }

  get taskName() {
    return CleanupSessionsTask.name;
  }
}
