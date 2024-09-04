import { Mutex } from 'async-mutex';
import { isError, isString } from 'lodash-es';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { OfflineProgramStream } from './OfflinePlayer.js';
import { PlayerContext } from './PlayerStreamContext.js';
import { ProgramStream } from './ProgramStream.js';
import { ProgramStreamFactory } from './ProgramStreamFactory.js';

export class FfmpegTrancodeSessionFactory {
  private logger = LoggerFactory.child({
    className: FfmpegTranscodeSession.name,
  });
  private underlying: ProgramStream;
  private transcodeSession: FfmpegTranscodeSession;
  private lock: Mutex = new Mutex();

  constructor(
    private context: PlayerContext,
    private settingsDB: SettingsDB = getSettings(),
  ) {
    this.underlying = ProgramStreamFactory.create(
      this.context,
      this.settingsDB,
    );
  }

  async create(): Promise<FfmpegTranscodeSession> {
    return this.lock.runExclusive(async () => {
      if (this.transcodeSession) {
        return this.transcodeSession;
      }

      try {
        this.transcodeSession = await this.underlying.setup();
        this.transcodeSession.on('close', () => this.underlying.shutdown());
        this.transcodeSession.on('end', () => this.underlying.shutdown());
        this.transcodeSession.on('error', () => this.underlying.shutdown());
        return this.transcodeSession;
      } catch (err) {
        const actualError = isError(err)
          ? err
          : new Error(
              'Program player had an error before receiving any data. ' +
                JSON.stringify(err),
            );

        if (this.context.lineupItem.type === 'error') {
          const msg = isString(this.context.lineupItem.error)
            ? this.context.lineupItem.error
            : '';
          throw new Error(
            'Additional error when attempting to play error stream. ' + msg,
          );
        }
        this.logger.error(
          actualError,
          'Error when attempting to play video. Fallback to error stream',
        );

        // Retry once with an error stream:
        this.context.lineupItem = {
          type: 'error',
          error: actualError.message,
          start: this.context.lineupItem.start,
          streamDuration: this.context.lineupItem.streamDuration,
          duration: this.context.lineupItem.duration,
        };

        this.shutdown();
        this.underlying = new OfflineProgramStream(true, this.context);
        return this.underlying.setup();
      }
    });
  }

  shutdown() {
    this.underlying.shutdown();
  }
}
