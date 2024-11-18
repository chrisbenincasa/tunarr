import {
  compact,
  filter,
  initial,
  isNil,
  isUndefined,
  maxBy,
  values,
} from 'lodash-es';
import { ChannelDB } from '../db/ChannelDB.ts';
import { Channel } from '../db/schema/Channel.ts';
import {
  ChannelNotFoundError,
  GenericError,
  TypedError,
} from '../types/errors.js';
import { Result } from '../types/result.js';
import { Maybe } from '../types/util.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { MutexMap } from '../util/mutexMap.js';
import { ConcatSession, ConcatSessionOptions } from './ConcatSession.js';
import { ConcatSessionType, HlsConcatSessionType, Session } from './Session.js';
import { HlsSession, HlsSessionOptions } from './hls/HlsSession.js';
import {
  HlsSlowerSession,
  HlsSlowerSessionOptions,
} from './hls/HlsSlowerSession.js';

import { ChannelStreamMode } from '@tunarr/types';
import { StreamConnectionDetails } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { OnDemandChannelService } from '../services/OnDemandChannelService.js';
import { ifDefined } from '../util/index.js';
import { SessionType } from './Session.js';

export type SessionKey = `${string}_${SessionType}`;

export class SessionManager {
  #logger = LoggerFactory.child({ className: this.constructor.name });
  #sessionLocker = new MutexMap();
  #sessions: Record<SessionKey, Session> = {};

  private constructor(
    private channelDB: ChannelDB,
    private onDemandChannelService: OnDemandChannelService,
  ) {}

  static create(
    channelDB: ChannelDB,
    onDemandChannelService: OnDemandChannelService,
  ) {
    return new SessionManager(channelDB, onDemandChannelService);
  }

  allSessions(): Record<SessionKey, Session> {
    return this.#sessions;
  }

  getHlsSlowerSession(id: string): Maybe<HlsSlowerSession> {
    return this.getSession(id, 'hls_slower') as Maybe<HlsSlowerSession>;
  }

  getHlsSession(id: string): Maybe<HlsSession> {
    return this.getSession(id, 'hls') as Maybe<HlsSession>;
  }

  getConcatSession(id: string): Maybe<ConcatSession> {
    return this.getSession(id, 'mpegts') as Maybe<ConcatSession>;
  }

  getHlsWrapperSession(
    id: string,
    typ: HlsConcatSessionType,
  ): Maybe<ConcatSession> {
    return this.getSession(id, typ) as Maybe<ConcatSession>;
  }

  getAllConcatSessions(id: string): Session[] {
    return compact([
      this.getConcatSession(id),
      this.getHlsWrapperSession(id, 'hls_concat'),
      this.getHlsWrapperSession(id, 'hls_slower_concat'),
    ]);
  }

  getSession(id: string, sessionType: SessionType): Maybe<Session> {
    return this.#sessions[sessionCacheKey(id, sessionType)];
  }

  getAllSessionsForChannel(id: string): Session[] {
    const sessions: Session[] = [];
    for (const key of Object.keys(this.#sessions)) {
      if (key.startsWith(id)) {
        sessions.push(this.#sessions[key as SessionKey]);
      }
    }
    return sessions;
  }

  async endSession(session: Session): Promise<void>;
  async endSession(
    idOrSession: string | Session,
    maybeSessionType?: SessionType,
  ): Promise<void> {
    let id: string;
    let sessionType: SessionType;
    if (idOrSession instanceof Session) {
      ({ id, sessionType } = idOrSession.keyObj);
    } else {
      if (isUndefined(maybeSessionType)) {
        throw new Error('Must pass session type if ending stream by ID');
      } else {
        id = idOrSession;
        sessionType = maybeSessionType;
      }
    }

    const lock = await this.#sessionLocker.getOrCreateLock(id);
    return await lock.runExclusive(async () => {
      const session = this.getSession(id, sessionType);
      if (isNil(session)) {
        return;
      }
      await session.stop();
      delete this.#sessions[sessionCacheKey(id, sessionType)];
    });
  }

  cleanupStaleSessions() {
    for (const session of Object.values(this.#sessions)) {
      if (session.isStale() && session.scheduleCleanup()) {
        this.#logger.debug(
          { sessionType: session.sessionType, id: session.id },
          'Scheduled cleanup on session',
        );
      }
    }
  }

  async getOrCreateConcatSession(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    options: ConcatSessionOptions,
  ) {
    const lock = await this.#sessionLocker.getOrCreateLock(channelId);
    await lock.runExclusive(() => {
      const underlyingSessionType = sessionTypeFromConcatType(
        options.sessionType,
      );
      if (isUndefined(this.getSession(channelId, underlyingSessionType))) {
        this.#logger.warn(
          'No underlying session of type %s found for existing concat session (channel id = %s). Removing dangling session and recreating',
          underlyingSessionType,
          channelId,
        );
        this.deleteSession(channelId, underlyingSessionType);
      }
    });

    return this.getOrCreateSession(
      channelId,
      token,
      connection,
      options.sessionType,
      (channel) => new ConcatSession(channel, options),
    );
  }

  // TODO Consider using a builder pattern here with generics to control
  // the returned session type
  async getOrCreateHlsSlowerSession(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    options: Omit<
      HlsSlowerSessionOptions,
      'sessionType' | 'initialSegmentCount'
    >,
  ) {
    return this.getOrCreateSession(
      channelId,
      token,
      connection,
      'hls_slower',
      (channel) =>
        new HlsSlowerSession(channel, {
          ...options,
          initialSegmentCount: 2, // 8 seconds of content
          sessionType: 'hls_slower',
        }),
    );
  }

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

  private async getOrCreateSession<TSession extends Session>(
    channelId: string,
    token: string,
    connection: StreamConnectionDetails,
    sessionType: SessionType,
    sessionFactory: (channel: Channel) => TSession,
  ): Promise<Result<TSession, TypedError>> {
    const lock = await this.#sessionLocker.getOrCreateLock(channelId);
    try {
      const session = await lock.runExclusive(async () => {
        let session = this.getSession(
          channelId,
          sessionType,
        ) as Maybe<TSession>;

        if (isNil(session)) {
          const channel = await this.channelDB.getChannel(channelId);
          if (isNil(channel)) {
            throw new ChannelNotFoundError(channelId);
          }

          session = sessionFactory(channel);

          this.addSession(channel.uuid, session.sessionType, session);

          session.on('error', (e) => {
            this.#logger.error(
              { error: e, sessionType, channelId },
              'Received error from session. Shutting down',
            );
            session?.stop().catch((e) => {
              this.#logger.error(
                e,
                'Error while shutting down session. Things are bad!',
              );
            });
            this.shutdownChildSessions(channelId, sessionType);
          });

          session.on('stop', () => {
            this.deleteSession(channelId, sessionType);
            this.shutdownChildSessions(channelId, sessionType);
          });

          session.on('cleanup', () => {
            this.deleteSession(channelId, sessionType);
            this.shutdownChildSessions(channelId, sessionType);
          });

          session.on('removeConnection', (_, connection) => {
            // Error handled below
            if (session) {
              this.pauseChannelIfNecessary(session, connection).catch(() => {});
            }
          });

          if (this.getAllSessionsForChannel(channelId).length === 0) {
            this.resumeChannelIfNecessary(channelId);
          }
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

  private addSession(id: string, sessionType: SessionType, session: Session) {
    this.#sessions[sessionCacheKey(id, sessionType)] = session;
  }

  private deleteSession(id: string, sessionType: SessionType) {
    const key = sessionCacheKey(id, sessionType);
    ifDefined(this.#sessions[key], (session) => {
      session.stop().catch((e) => {
        this.#logger.error(e, 'Error shutting down session');
      });
    });
    delete this.#sessions[key];
  }

  private resumeChannelIfNecessary(channelId: string) {
    this.onDemandChannelService.resumeChannel(channelId).catch((e) => {
      this.#logger.error(e, 'Error resuming on-demand channel %s', channelId);
    });
  }

  private async pauseChannelIfNecessary(
    session: Session,
    lastConnection: StreamConnectionDetails,
  ) {
    try {
      let sessionToCheck = session;
      let pauseTime = lastConnection.lastHeartbeat ?? +dayjs();
      if (session.isConcatSession()) {
        const underlyingType = sessionTypeFromConcatType(session.sessionType);
        const underlyingSession = this.getSession(
          session.keyObj.id,
          underlyingType,
        );
        if (underlyingSession) {
          sessionToCheck = underlyingSession;
          pauseTime =
            maxBy(values(sessionToCheck.connections()), 'lastHeartbeat')
              ?.lastHeartbeat ?? +dayjs();
        }
      }

      const nonTunarrConnections = filter(
        sessionToCheck.connections(),
        (conn) => !(conn.userAgent?.includes('Tunarr') ?? false),
      ).length;

      // Pause the channel as soon as there are no connections
      // other than internal connections
      if (nonTunarrConnections === 0) {
        await this.onDemandChannelService.pauseChannel(
          session.keyObj.id,
          pauseTime,
        );
      }
    } catch (e) {
      this.#logger.error(
        e,
        'Error while trying to pause channel %s',
        session.id,
      );
    }
  }

  private shutdownChildSessions(id: string, sessionType: SessionType) {
    this.getSession(id, concatSessionTypeForSessionType(sessionType))
      ?.stop()
      .catch((e) => {
        this.#logger.error(e, 'Error shutting down associated concat session');
      });
  }
}

function sessionTypeFromConcatType(typ: ConcatSessionType): ChannelStreamMode {
  return initial(typ.split('_')).join('_') as ChannelStreamMode;
}

function concatSessionTypeForSessionType(typ: SessionType): ConcatSessionType {
  return `${typ}_concat` as ConcatSessionType;
}

function sessionCacheKey(id: string, sessionType: SessionType): SessionKey {
  return `${id}_${sessionType}`;
}
