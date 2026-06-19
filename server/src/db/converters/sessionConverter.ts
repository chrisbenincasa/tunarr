import type { ChannelSession } from '@tunarr/types';
import dayjs from 'dayjs';
import { isNil, map } from 'lodash-es';
import type { Session } from '../../stream/Session.ts';

export function sessionToApiSession(session: Session): ChannelSession {
  return {
    connections: map(session.connections(), (connection, token) => {
      const lastHeartbeat = session?.lastHeartbeat(token);
      console.log(dayjs(lastHeartbeat).format());
      return {
        ...connection,
        lastHeartbeat,
        lastHeartbeatStr: !isNil(lastHeartbeat)
          ? dayjs(lastHeartbeat).format()
          : undefined,
      };
    }),
    type: session.sessionType,
    state: session.state,
    numConnections: session.numConnections(),
  } satisfies ChannelSession;
}
