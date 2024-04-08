import { chain, filter, forEach, isEmpty, keys } from 'lodash-es';
import { sessionManager } from '../stream/sessionManager.js';
import { Maybe } from '../types.js';
import { Task, TaskId } from './task.js';

const ThirtySeconds = 30 * 1000;

export class CleanupSessionsTask extends Task<void> {
  public static ID: TaskId = 'cleanup-sessions';
  public ID = CleanupSessionsTask.ID;
  public static name = 'CleanupSessionsTask';

  // eslint-disable-next-line @typescript-eslint/require-await
  protected async runInternal(): Promise<Maybe<void>> {
    const sessions = filter(
      sessionManager.allSessions(),
      (session) => session.started,
    );

    if (isEmpty(sessions)) {
      return;
    }

    const now = new Date().getTime();

    forEach(sessions, (session) => {
      const [aliveConnections, staleConnections] = chain(
        keys(session.connections()),
      )
        .partition(
          (token) => now - session.lastHeartbeat(token) < ThirtySeconds,
        )
        .value();

      // Cleanup stale connections

      forEach(staleConnections, (conn) => session.removeConnection(conn));

      if (isEmpty(aliveConnections)) {
        session.scheduleCleanup(30000);
      }
    });
  }

  get taskName() {
    return CleanupSessionsTask.name;
  }
}
