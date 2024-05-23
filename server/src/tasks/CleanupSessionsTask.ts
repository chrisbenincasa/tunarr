import ld, { filter, forEach, isEmpty, keys } from 'lodash-es';
import { sessionManager } from '../stream/sessionManager.js';
import { Maybe } from '../types/util.js';
import { Task, TaskId } from './Task.js';

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
      // Handle HLS stale sessions differently
      if (session.sessionType === 'hls') {
        const [aliveConnections, staleConnections] = ld
          .chain(keys(session.connections()))
          .partition(
            (token) => now - session.lastHeartbeat(token) < ThirtySeconds,
          )
          .value();

        // Cleanup stale connections
        forEach(staleConnections, (conn) => session.removeConnection(conn));

        if (isEmpty(aliveConnections)) {
          this.logger.debug(
            'Scheduled cleanup on session (%s) %s in 40 seconds',
            session.sessionType,
            session.id,
          );
          session.scheduleCleanup(30000);
        }

        return;
      }

      if (session.sessionType === 'concat' && isEmpty(session.connections())) {
        // TODO Make this timeout configurable.
        this.logger.debug(
          'Scheduled cleanup on session (%s) %s in 15 seconds',
          session.sessionType,
          session.id,
        );
        session.scheduleCleanup(15000);
      }
    });
  }

  get taskName() {
    return CleanupSessionsTask.name;
  }
}
