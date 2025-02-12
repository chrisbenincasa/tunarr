import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { CacheImageService } from '@/services/cacheImageService.js';
import { Result } from '@/types/result.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import dayjs from 'dayjs';
import { isError, isUndefined } from 'lodash-es';
import type { FFmpegFactory } from '../ffmpeg/FFmpegModule.ts';
import type { StreamOptions } from '../ffmpeg/ffmpegBase.ts';
import type { PlayerContext } from './PlayerStreamContext.ts';
import { ProgramStream } from './ProgramStream.ts';

/**
 * Player for flex, error, and other misc non-content streams.
 */
export class OfflineProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  constructor(
    settingsDB: ISettingsDB,
    cacheImageService: CacheImageService,
    ffmpegFactory: FFmpegFactory,
    private error: boolean,
    context: PlayerContext,
    outputFormat: OutputFormat,
  ) {
    super(context, outputFormat, settingsDB, cacheImageService, ffmpegFactory);
  }

  protected shutdownInternal() {}

  async setupInternal(
    opts?: Partial<StreamOptions>,
  ): Promise<Result<FfmpegTranscodeSession>> {
    try {
      const ffmpeg = this.ffmpegFactory(
        this.context.transcodeConfig,
        this.context.targetChannel,
        this.context.streamMode,
      );
      const lineupItem = this.context.lineupItem;
      let duration = dayjs.duration(lineupItem.streamDuration);
      const start = dayjs.duration(lineupItem.startOffset ?? 0);
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
        return Result.forError(err);
      } else {
        return Result.forError(
          new Error(
            'Error when attempting to play offline screen: ' +
              JSON.stringify(err),
          ),
        );
      }
    }
  }
}
