import { SettingsDB, getSettings } from '@/db/SettingsDB.ts';
import { FFmpegFactory } from '@/ffmpeg/FFmpegFactory.ts';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { OutputFormat } from '@/ffmpeg/builder/constants.ts';
import { StreamOptions } from '@/ffmpeg/ffmpeg.js';
import { Result } from '@/types/result.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { makeLocalUrl } from '@/util/serverUtil.js';
import dayjs from 'dayjs';
import { isError, isUndefined } from 'lodash-es';
import { PlayerContext } from './PlayerStreamContext.js';
import { ProgramStream } from './ProgramStream.js';

export class OfflineProgramStreamFactory {
  constructor(private settingsDB: SettingsDB) {}

  build(context: PlayerContext, outputFormat: OutputFormat) {
    return new OfflineProgramStream(
      false,
      context,
      outputFormat,
      this.settingsDB,
    );
  }
}

export class ErrorProgramStreamFactory {
  constructor(private settingsDB: SettingsDB) {}

  build(context: PlayerContext, outputFormat: OutputFormat) {
    return new OfflineProgramStream(
      true,
      context,
      outputFormat,
      this.settingsDB,
    );
  }
}

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
    outputFormat: OutputFormat,
    settingsDB: SettingsDB = getSettings(),
  ) {
    super(context, outputFormat, settingsDB);
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

  async setupInternal(
    opts?: Partial<StreamOptions>,
  ): Promise<Result<FfmpegTranscodeSession>> {
    try {
      const ffmpeg = FFmpegFactory.getFFmpegPipelineBuilder(
        this.settingsDB.ffmpegSettings(),
        this.context.channel,
      );
      const lineupItem = this.context.lineupItem;
      let duration = dayjs.duration(lineupItem.streamDuration ?? 0);
      const start = dayjs.duration(lineupItem.start ?? 0);
      if (+duration > +start) {
        duration = duration.subtract(start);
      }

      this.logger.debug(
        'starting offline session of %d ms',
        duration.asMilliseconds(),
      );
      const ff = this.error
        ? await ffmpeg.createErrorSession(
            'Error',
            undefined,
            duration,
            this.outputFormat,
            opts?.realtime ?? true,
            opts?.ptsOffset,
          )
        : await ffmpeg.createOfflineSession(
            duration,
            this.outputFormat,
            opts?.ptsOffset,
            opts?.realtime,
          );

      if (isUndefined(ff)) {
        throw new Error('Unable to start ffmpeg transcode session');
      }

      return Result.success(ff);
    } catch (err) {
      if (isError(err)) {
        return Result.failure(err);
      } else {
        return Result.failure(
          new Error(
            'Error when attempting to play offline screen: ' +
              JSON.stringify(err),
          ),
        );
      }
    }
  }
}
