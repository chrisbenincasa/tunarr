import dayjs from 'dayjs';
import { isError, isUndefined } from 'lodash-es';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { FfmpegTranscodeSession } from '../ffmpeg/FfmpegTrancodeSession.js';
import { FFMPEG } from '../ffmpeg/ffmpeg.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { makeLocalUrl } from '../util/serverUtil.js';
import { PlayerContext } from './PlayerStreamContext.js';
import { ProgramStream } from './ProgramStream.js';

/**
 * Player for flex, error, and other misc non-content streams.
 */
export class OfflineProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(
    private error: boolean,
    context: PlayerContext,
    settingsDB: SettingsDB = getSettings(),
  ) {
    super(context, settingsDB);
    if (context.isLoading === true) {
      context.channel = {
        ...context.channel,
        offline: {
          ...context.channel.offline,
          mode: 'pic',
          picture: makeLocalUrl('/images/loading-screen.png'),
          soundtrack: undefined,
        },
      };
    }
  }

  protected shutdownInternal() {}

  async setupInternal(): Promise<FfmpegTranscodeSession> {
    try {
      const ffmpeg = new FFMPEG(
        this.settingsDB.ffmpegSettings(),
        this.context.channel,
        this.context.audioOnly,
      );
      const lineupItem = this.context.lineupItem;
      let duration = dayjs.duration(lineupItem.streamDuration ?? 0);
      const start = dayjs.duration(lineupItem.start ?? 0);
      if (+duration > +start) {
        duration = duration.subtract(start);
      }

      const ff = this.error
        ? await ffmpeg.createErrorSession('Error', undefined, duration)
        : await ffmpeg.createOfflineSession(duration);

      if (isUndefined(ff)) {
        throw new Error('Unable to start ffmpeg transcode session');
      }

      return ff;
    } catch (err) {
      if (isError(err)) {
        throw err;
      } else {
        throw new Error(
          'Error when attempting to play offline screen: ' +
            JSON.stringify(err),
        );
      }
    }
  }
}
