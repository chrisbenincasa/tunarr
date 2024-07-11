import { Channel } from '../dao/entities/Channel.js';
import {
  SessionOptions,
  SessionType,
  StreamConnectionDetails,
  StreamSession,
} from './StreamSession.js';
import { isNil, isNull } from 'lodash-es';
import { getEm } from '../dao/dataSource.js';
import { ConcatSession } from './ConcatSession.js';
import { HlsSession, HlsSessionOptions } from './HlsSession.js';
import { Maybe, Nullable } from '../types/util.js';
import { MutexMap } from '../util/mutexMap.js';

class SessionManager {
  #sessionLocker = new MutexMap();
  #sessions: Record<string, StreamSession> = {};

  private constructor() {}

  static create() {
    return new SessionManager();
  }

  allSessions(): Record<string, StreamSession> {
    return this.#sessions;
  }

  getHlsSession(id: string): Maybe<HlsSession> {
    return this.getSession(id, 'hls') as Maybe<HlsSession>;
  }

  getConcatSession(id: string): Maybe<ConcatSession> {
    return this.getSession(id, 'concat') as Maybe<ConcatSession>;
  }

  getSession(id: string, sessionType: SessionType): Maybe<StreamSession> {
    return this.#sessions[sessionCacheKey(id, sessionType)];
  }

  async endSession(id: string, sessionType: SessionType) {
    const lock = await this.#sessionLocker.getOrCreateLock(id);
    return await lock.runExclusive(() => {
      const session = this.getSession(id, sessionType);
      if (isNil(session)) {
        return;
      }
      session.stop();
    });
  }

  async getOrCreateConcatSession(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    options: Omit<SessionOptions, 'sessionType'>,
  ) {
    return this.getOrCreateSession(
      channelId,
      token,
      connection,
      'concat',
      (channel) =>
        ConcatSession.create(channel, { ...options, sessionType: 'concat' }),
    );
  }

  // TODO Consider using a builder pattern here with generics to control
  // the returned session type
  async getOrCreateHlsSession(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    options: Omit<HlsSessionOptions, 'sessionType'>,
  ) {
    return this.getOrCreateSession(
      channelId,
      token,
      connection,
      'hls',
      (channel) => new HlsSession(channel, { ...options, sessionType: 'hls' }),
    );
  }

  private async getOrCreateSession<Session extends StreamSession>(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    sessionType: SessionType,
    sessionFactory: (channel: Channel) => Session,
  ): Promise<Nullable<Session>> {
    const lock = await this.#sessionLocker.getOrCreateLock(channelId);
    const session = await lock.runExclusive(async () => {
      const channel = await getEm().findOne(Channel, { uuid: channelId });
      if (isNil(channel)) {
        return null;
      }

      let session = this.getSession(channelId, sessionType) as Maybe<Session>;
      if (isNil(session)) {
        session = sessionFactory(channel);
        this.addSession(channel.uuid, session.sessionType, session);
      }

      if (!session.started || session.hasError) {
        await session.start();
      }

      return session;
    });

    if (isNull(session)) {
      return null;
    }

    if (session.hasError) {
      return null;
    }

    session.addConnection(token, connection);

    return session;
  }

  private addSession(
    id: string,
    sessionType: SessionType,
    session: StreamSession,
  ) {
    this.#sessions[sessionCacheKey(id, sessionType)] = session;
  }
}

function sessionCacheKey(id: string, sessionType: SessionType): string {
  return `${id}_${sessionType}`;
}

export const sessionManager = SessionManager.create();
