import { FfmpegSettings } from '@tunarr/types';
import { Channel } from '../dao/entities/Channel.js';
import { StreamConnectionDetails, StreamSession } from './session.js';
import { isNil } from 'lodash-es';

class SessionManager {
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

  endSession(id: string) {
    const session = this.getSession(id);
    if (isNil(session)) {
      return;
    }
    session;
  }

  async getOrCreateSession(
    channel: Channel,
    ffmpegSettings: FfmpegSettings,
    token: string,
    connection: StreamConnectionDetails,
  ) {
    let session = this.#sessions[channel.uuid];
    if (!session) {
      session = StreamSession.create(channel, ffmpegSettings);
      this.#sessions[channel.uuid] = session;
    }

    if (!session.started) {
      await session.start();
    }

    if (session.hasError) {
      return null;
    }

    session.addConnection(token, connection);

    return session;
  }
}

export const sessionManager = SessionManager.create();
