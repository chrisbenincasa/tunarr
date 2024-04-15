import { FfmpegSettings } from '@tunarr/types';
import { Channel } from '../dao/entities/Channel.js';
import { StreamConnectionDetails, StreamSession } from './session.js';
import { isNil, isNull } from 'lodash-es';
import { Mutex } from 'async-mutex';
import { getEm } from '../dao/dataSource.js';

class SessionManager {
  // A little janky, but we have the global lock which protects the locks map
  // Then the locks map protects the get/create of each session per channel.
  #mu = new Mutex();
  #locks: Record<string, Mutex> = {};
  #sessions: Record<string, StreamSession> = {};

  private constructor() {}

  static create() {
    return new SessionManager();
  }

  allSessions(): Record<string, StreamSession> {
    return this.#sessions;
  }

  getSession(id: string): StreamSession | undefined {
    return this.#sessions[id];
  }

  async endSession(id: string) {
    const lock = await this.getOrCreateLock(id);
    return await lock.runExclusive(() => {
      const session = this.getSession(id);
      if (isNil(session)) {
        return;
      }
      session.stop();
    });
  }

  async getOrCreateSession(
    channelId: string,
    ffmpegSettings: FfmpegSettings,
    token: string,
    connection: StreamConnectionDetails,
  ) {
    const lock = await this.getOrCreateLock(channelId);
    const session = await lock.runExclusive(async () => {
      const channel = await getEm().findOne(Channel, { uuid: channelId });
      if (isNil(channel)) {
        return null;
      }

      let session = this.#sessions[channel.uuid];
      if (!session) {
        session = StreamSession.create(channel, ffmpegSettings);
        this.#sessions[channel.uuid] = session;
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

  private async getOrCreateLock(id: string) {
    return await this.#mu.runExclusive(() => {
      let lock = this.#locks[id];
      if (!lock) {
        this.#locks[id] = lock = new Mutex();
      }
      return lock;
    });
  }
}

export const sessionManager = SessionManager.create();
