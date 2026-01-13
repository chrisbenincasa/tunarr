import { SessionManager } from '@/stream/SessionManager.js';
import { KEYS } from '@/types/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { SimpleTask, TaskId } from './Task.js';
import { simpleTaskDef } from './TaskRegistry.ts';

@injectable()
@simpleTaskDef({
  description: 'Cleans stale sessions from the stream session manager',
})
export class CleanupSessionsTask extends SimpleTask {
  static KEY = Symbol.for(CleanupSessionsTask.name);
  public static ID: TaskId = 'cleanup-sessions';
  public ID = CleanupSessionsTask.ID;

  constructor(
    @inject(KEYS.Logger) logger: Logger,
    @inject(SessionManager) private sessionManager: SessionManager,
  ) {
    super(logger);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<void> {
    this.sessionManager.cleanupStaleSessions();
  }

  get taskName() {
    return CleanupSessionsTask.name;
  }
}
