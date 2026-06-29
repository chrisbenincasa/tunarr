import { SessionManager } from '@/stream/SessionManager.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import type { TaskId } from './Task.js';
import { SimpleTask } from './Task.js';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description: 'Cleans stale sessions from the stream session manager',
})
export class CleanupSessionsTask extends SimpleTask {
  @InjectLogger() protected declare readonly logger: Logger;

  static KEY = Symbol.for(CleanupSessionsTask.name);
  public static ID: TaskId = 'cleanup-sessions';
  public ID = CleanupSessionsTask.ID;

  constructor(
    @inject(SessionManager) private sessionManager: SessionManager,
  ) {
    super();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<void> {
    this.sessionManager.cleanupStaleSessions();
  }

  get taskName() {
    return CleanupSessionsTask.name;
  }
}
