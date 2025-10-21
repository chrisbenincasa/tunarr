import { isJellyfinBackedLineupItem } from '@/db/derived_types/StreamLineup.js';
import { type ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { type MediaSourceDB } from '@/db/mediaSourceDB.js';
import { MediaSourceType } from '@/db/schema/base.js';
import { type FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { type OutputFormat } from '@/ffmpeg/builder/constants.js';
import type { StreamOptions } from '@/ffmpeg/ffmpegBase.js';
import { type IFFMPEG } from '@/ffmpeg/ffmpegBase.js';
import { type CacheImageService } from '@/services/cacheImageService.js';
import { type PlayerContext } from '@/stream/PlayerStreamContext.js';
import { ProgramStream } from '@/stream/ProgramStream.js';
import { type UpdateJellyfinPlayStatusScheduledTask } from '@/tasks/jellyfin/UpdateJellyfinPlayStatusTask.js';
import { Result } from '@/types/result.js';
import { type Maybe, type Nullable } from '@/types/util.js';
import { ifDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import dayjs from 'dayjs';
import { type interfaces } from 'inversify';
import { isNil, isUndefined } from 'lodash-es';
import { format } from 'node:util';
import { type FFmpegFactory } from '../../ffmpeg/FFmpegModule.js';
import { type JellyfinStreamDetails } from './JellyfinStreamDetails.js';

export class JellyfinProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: JellyfinProgramStream.name,
  });

  private ffmpeg: Nullable<IFFMPEG> = null;
  private killed: boolean = false;
  private updatePlayStatusTask: Maybe<UpdateJellyfinPlayStatusScheduledTask>;

  constructor(
    settingsDB: ISettingsDB,
    private mediaSourceDB: MediaSourceDB,
    private streamDetailsFactory: interfaces.AutoFactory<JellyfinStreamDetails>,
    cacheImageService: CacheImageService,
    ffmpegFactory: FFmpegFactory,
    context: PlayerContext,
    outputFormat: OutputFormat,
  ) {
    super(context, outputFormat, settingsDB, cacheImageService, ffmpegFactory);
  }

  protected shutdownInternal() {
    this.killed = true;
    ifDefined(this.updatePlayStatusTask, (task) => {
      task.stop();
    });
  }

  async setupInternal(
    opts?: StreamOptions,
  ): Promise<Result<FfmpegTranscodeSession>> {
    const lineupItem = this.context.lineupItem;
    if (!isJellyfinBackedLineupItem(lineupItem)) {
      return Result.forError(
        new Error(
          'Lineup item is not backed by a media source: ' +
            JSON.stringify(lineupItem),
        ),
      );
    }

    const jellyfinExternalInfo = lineupItem.program.externalIds.find(
      (eid) => eid.sourceType === MediaSourceType.Jellyfin,
    );

    if (!jellyfinExternalInfo) {
      return Result.forError(
        new Error(
          format(
            'Could not find Jellyfin external info for program ID %s',
            lineupItem.program.uuid,
          ),
        ),
      );
    }

    const server = await this.mediaSourceDB.findByType(
      MediaSourceType.Jellyfin,
      lineupItem.program.mediaSourceId,
    );

    if (isNil(server)) {
      return Result.forError(
        new Error(`Unable to find Jellyfin server specified by program.`),
      );
    }

    const jellyfinStreamDetails = this.streamDetailsFactory();

    const watermark = await this.getWatermark();
    this.ffmpeg = this.ffmpegFactory(
      this.context.transcodeConfig,
      this.context.sourceChannel,
      this.context.streamMode,
    );

    const streamResult = await jellyfinStreamDetails.getStream({
      server,
      lineupItem: lineupItem.program,
    });
    if (streamResult.isFailure()) {
      return Result.forError(
        new Error('Unable to retrieve stream details from Jellyfin'),
      );
    }

    if (this.killed) {
      return Result.forError(new Error('Stream was killed already, returning'));
    }

    const stream = streamResult.get();

    const streamStats = stream.streamDetails;
    if (streamStats) {
      streamStats.duration = dayjs.duration(lineupItem.streamDuration);
    }

    const start = dayjs.duration(lineupItem.startOffset ?? 0);

    const ffmpegOutStream = await this.ffmpeg.createStreamSession({
      stream: {
        source: stream.streamSource,
        details: stream.streamDetails,
      },
      options: {
        startTime: start,
        duration: dayjs.duration(lineupItem.streamDuration),
        watermark,
        realtime: this.context.realtime,
        extraInputHeaders: {},
        outputFormat: this.outputFormat,
        streamMode: this.context.streamMode,
        ...(opts ?? {}),
      },
      lineupItem,
    });

    if (isUndefined(ffmpegOutStream)) {
      return Result.forError(new Error('Unable to spawn ffmpeg'));
    }

    return Result.success(ffmpegOutStream);
  }
}
