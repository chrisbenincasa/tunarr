import { compact, isError, isNil, isString } from 'lodash-es';
import { ChannelDB } from '../dao/channelDb.js';
import { Channel } from '../dao/direct/derivedTypes.js';
import { Result } from '../types/result.js';
import { Maybe } from '../types/util.js';
import { MutexMap } from '../util/mutexMap.js';
import { ConcatSession, ConcatSessionOptions } from './ConcatSession.js';
import { HlsSession, HlsSessionOptions } from './HlsSession.js';
import {
  SessionType,
  StreamConnectionDetails,
  StreamSession,
} from './StreamSession.js';

export type SessionKey = `${string}_${SessionType}`;

type KnownErrorTypes = 'channel_not_found' | 'generic_error';
abstract class TypedError extends Error {
  readonly type: KnownErrorTypes;

  constructor(public message: string) {
    super(message);
  }

  static fromError(e: Error): TypedError {
    if (e instanceof TypedError) {
      return e;
    }

    return new GenericError(e.message);
  }

  static fromAny(e: unknown): TypedError {
    if (isError(e)) {
      return this.fromError(e);
    }

    if (isString(e)) {
      return new GenericError(e);
    }

    return new GenericError(JSON.stringify(e));
  }
}

class GenericError extends TypedError {
  readonly type = 'generic_error';
}

class ChannelNotFoundError extends TypedError {
  readonly type = 'channel_not_found';
  constructor(channelId: string) {
    super(`Channel ${channelId} not found`);
  }
}

export class SessionManager {
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
