import { isContentBackedLineupIteam } from '@/db/derived_types/StreamLineup.js';
import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import type { MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/MediaSource.js';
import type { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import type { OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { StreamOptions } from '@/ffmpeg/ffmpeg.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import type { CacheImageService } from '@/services/cacheImageService.js';
import type { PlayerContext } from '@/stream/PlayerStreamContext.js';
import { ProgramStream } from '@/stream/ProgramStream.js';
import { UpdatePlexPlayStatusScheduledTask } from '@/tasks/plex/UpdatePlexPlayStatusTask.js';
import { Result } from '@/types/result.js';
import type { Maybe } from '@/types/util.js';
import { ifDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import dayjs from 'dayjs';
import type { interfaces } from 'inversify';
import { isNil, isNull, isUndefined } from 'lodash-es';
import type { FFmpegFactory } from '../../ffmpeg/FFmpegModule.js';
import type { PlexStreamDetails } from './PlexStreamDetails.js';

export class PlexProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: PlexProgramStream.name,
  });

  private killed = false;
  private updatePlexStatusTask: Maybe<UpdatePlexPlayStatusScheduledTask>;

  constructor(
    settingsDB: ISettingsDB,
    private mediaSourceDB: MediaSourceDB,
    private plexStreamDetailsFactory: interfaces.AutoFactory<PlexStreamDetails>,
    cacheImageService: CacheImageService,
    ffmpegFactory: FFmpegFactory,
    context: PlayerContext,
    outputFormat: OutputFormat,
  ) {
    super(context, outputFormat, settingsDB, cacheImageService, ffmpegFactory);
  }

  protected shutdownInternal() {
    this.killed = true;
    ifDefined(this.updatePlexStatusTask, (task) => {
      task.stop();
    });
  }

  protected async setupInternal(
    opts?: Partial<StreamOptions>,
  ): Promise<Result<FfmpegTranscodeSession>> {
    const lineupItem = this.context.lineupItem;
    if (!isContentBackedLineupIteam(lineupItem)) {
      return Result.failure(
        new Error(
          'Lineup item is not backed by Plex: ' + JSON.stringify(lineupItem),
        ),
      );
    }

    const server = await this.mediaSourceDB.findByType(
      MediaSourceType.Plex,
      lineupItem.externalSourceId,
    );
    if (isNil(server)) {
      return Result.failure(
        new Error(
          `Unable to find server "${lineupItem.externalSourceId}" specified by program.`,
        ),
      );
    }

    if (server.uri.endsWith('/')) {
      server.uri = server.uri.slice(0, server.uri.length - 1);
    }

    const plexSettings = this.settingsDB.plexSettings();
    const plexStreamDetails = this.plexStreamDetailsFactory();

    const watermark = await this.getWatermark();
    const ffmpeg = this.ffmpegFactory(
      this.context.transcodeConfig,
      this.context.sourceChannel,
      this.context.streamMode,
    );

    const stream = await plexStreamDetails.getStream(server, lineupItem);
    if (isNull(stream)) {
      return Result.failure(
        new Error('Unable to retrieve stream details from Plex'),
      );
    }

    if (this.killed) {
      this.logger.warn('Plex stream was killed already, returning');
      return Result.failure(new Error('Plex stream was killed already'));
    }

    const streamStats = stream.streamDetails;
    if (streamStats) {
      streamStats.duration = lineupItem.streamDuration
        ? dayjs.duration(lineupItem.streamDuration)
        : undefined;
    }

    const start = dayjs.duration(lineupItem.startOffset ?? 0);

    const transcodeSession = await ffmpeg.createStreamSession({
      streamSource: stream.streamSource,
      streamDetails: stream.streamDetails,
      startTime: start,
      duration: dayjs.duration(
        +start === 0
          ? lineupItem.duration
          : lineupItem.streamDuration ?? lineupItem.duration,
      ),
      watermark,
      realtime: this.context.realtime,
      outputFormat: this.outputFormat,
      streamMode: this.context.streamMode,
      ...(opts ?? {}),
    });

    if (isUndefined(transcodeSession)) {
      return Result.failure(new Error('Unable to create ffmpeg process'));
    }

    if (plexSettings.updatePlayStatus) {
      this.updatePlexStatusTask = new UpdatePlexPlayStatusScheduledTask(
        server,
        {
          channelNumber: this.context.sourceChannel.number,
          duration: lineupItem.duration,
          ratingKey: lineupItem.externalKey,
          startTime: lineupItem.startOffset ?? 0,
        },
      );

      GlobalScheduler.scheduleTask(
        this.updatePlexStatusTask.id,
        this.updatePlexStatusTask,
      );
    }

    return Result.success(transcodeSession);
  }
}
