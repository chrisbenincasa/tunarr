import { SessionManager } from '@/stream/SessionManager.js';
import { KEYS } from '@/types/inject.js';
import { Maybe } from '@/types/util.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { inject, injectable } from 'inversify';
import { Task, TaskId } from './Task.js';

@injectable()
export class CleanupSessionsTask extends Task {
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
  protected async runInternal(): Promise<Maybe<void>> {
    this.sessionManager.cleanupStaleSessions();
  }

  get taskName() {
    return CleanupSessionsTask.name;
  }
}
