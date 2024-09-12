import { compact, isNil, isUndefined } from 'lodash-es';
import { ChannelDB } from '../dao/channelDb.js';
import { Channel } from '../dao/direct/derivedTypes.js';
import { Result } from '../types/result.js';
import { Maybe } from '../types/util.js';
import {
  ChannelNotFoundError,
  GenericError,
  TypedError,
} from '../util/errors.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { MutexMap } from '../util/mutexMap.js';
import { ConcatSession, ConcatSessionOptions } from './ConcatSession.js';
import { HlsSession, HlsSessionOptions } from './HlsSession.js';
import {
  SessionType,
  StreamConnectionDetails,
  StreamSession,
} from './StreamSession.js';

export type SessionKey = `${string}_${SessionType}`;

export class SessionManager {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  #sessionLocker = new MutexMap();
  #sessions: Record<SessionKey, StreamSession> = {};

  private constructor(private channelDB: ChannelDB) {}

  static create(channelDB: ChannelDB) {
    return new SessionManager(channelDB);
  }

  allSessions(): Record<SessionKey, StreamSession> {
    return this.#sessions;
  }

  getHlsSession(id: string): Maybe<HlsSession> {
    return this.getSession(id, 'hls') as Maybe<HlsSession>;
  }

  getConcatSession(id: string): Maybe<ConcatSession> {
    return this.getSession(id, 'concat') as Maybe<ConcatSession>;
  }

  getConcatHlsSession(id: string): Maybe<ConcatSession> {
    return this.getSession(id, 'concat_hls') as Maybe<ConcatSession>;
  }

  getAllConcatSessions(id: string): ConcatSession[] {
    return compact([this.getConcatSession(id), this.getConcatHlsSession(id)]);
  }

  getSession(id: string, sessionType: SessionType): Maybe<StreamSession> {
    return this.#sessions[sessionCacheKey(id, sessionType)];
  }

  async endSession(session: StreamSession): Promise<void>;
  async endSession(
    idOrSession: string | StreamSession,
    maybeSessionType?: SessionType,
  ): Promise<void> {
    let id: string;
    let sessionType: SessionType;
    if (idOrSession instanceof StreamSession) {
      id = idOrSession.keyObj.id;
      sessionType = idOrSession.keyObj.sessionType;
    } else {
      if (isUndefined(maybeSessionType)) {
        throw new Error('Must pass session type if ending stream by ID');
      } else {
        id = idOrSession;
        sessionType = maybeSessionType;
      }
    }

    const lock = await this.#sessionLocker.getOrCreateLock(id);
    return await lock.runExclusive(() => {
      const session = this.getSession(id, sessionType);
      if (isNil(session)) {
        return;
      }
      session.stop();
      delete this.#sessions[sessionCacheKey(id, sessionType)];
    });
  }

  cleanupStaleSessions() {
    for (const session of Object.values(this.#sessions)) {
      if (session.isStale() && session.scheduleCleanup()) {
        this.#logger.debug(
          'Scheduled cleanup on session (type=%s, id=%s)',
          session.sessionType,
          session.id,
        );
      }
    }
  }

  async getOrCreateConcatSession(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    options: Omit<ConcatSessionOptions, 'sessionType'>,
  ) {
    const sessionType: SessionType =
      options.mode === 'hls' ? 'concat_hls' : 'concat';
    return this.getOrCreateSession(
      channelId,
      token,
      connection,
      sessionType,
      (channel) => ConcatSession.create(channel, { ...options, sessionType }),
    );
  }

  // TODO Consider using a builder pattern here with generics to control
  // the returned session type
  async getOrCreateHlsSession(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    options: Omit<HlsSessionOptions, 'sessionType' | 'initialSegmentCount'>,
  ) {
    return this.getOrCreateSession(
      channelId,
      token,
      connection,
      'hls',
      (channel) =>
        new HlsSession(channel, {
          ...options,
          initialSegmentCount: 2, // 8 seconds of content
          sessionType: 'hls',
        }),
    );
  }

  private async getOrCreateSession<Session extends StreamSession>(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    sessionType: SessionType,
    sessionFactory: (channel: Channel) => Session,
  ): Promise<Result<Session, TypedError>> {
    const lock = await this.#sessionLocker.getOrCreateLock(channelId);
    try {
      const session = await lock.runExclusive(async () => {
        const channel = await this.channelDB.getChannelDirect(channelId);
        if (isNil(channel)) {
          throw new ChannelNotFoundError(channelId);
        }

        let session = this.getSession(channelId, sessionType) as Maybe<Session>;
        if (isNil(session)) {
          session = sessionFactory(channel);
          session.on('cleanup', () => {
            delete this.#sessions[sessionCacheKey(channelId, sessionType)];
          });
          this.addSession(channel.uuid, session.sessionType, session);
        }

        if (!session.started || session.hasError) {
          await session.start();
        }

        return session;
      });

      if (session.hasError) {
        throw (
          session.error ??
          new GenericError('Session reported error but had none set.')
        );
      }

      session.addConnection(token, connection);

      return Result.success(session);
    } catch (e) {
      return Result.failure(TypedError.fromAny(e));
    }
  }

  private addSession(
    id: string,
    sessionType: SessionType,
    session: StreamSession,
  ) {
    this.#sessions[sessionCacheKey(id, sessionType)] = session;
  }
}

function sessionCacheKey(id: string, sessionType: SessionType): SessionKey {
  return `${id}_${sessionType}`;
}
