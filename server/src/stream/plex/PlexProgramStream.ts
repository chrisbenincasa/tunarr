import dayjs from 'dayjs';
import { isNil, isNull, isUndefined } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';
import { isContentBackedLineupIteam } from '../../dao/derived_types/StreamLineup.js';
import { MediaSourceType } from '../../dao/direct/schema/MediaSource.ts';
import { MediaSourceDB } from '../../dao/mediaSourceDB.js';
import { SettingsDB, getSettings } from '../../dao/settings.js';
import { FfmpegStreamFactory } from '../../ffmpeg/FfmpegStreamFactory.ts';
import { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.js';
import { OutputFormat } from '../../ffmpeg/builder/constants.ts';
import { FFMPEG, StreamOptions } from '../../ffmpeg/ffmpeg.js';
import { GlobalScheduler } from '../../services/scheduler.js';
import { UpdatePlexPlayStatusScheduledTask } from '../../tasks/plex/UpdatePlexPlayStatusTask.js';
import { Result } from '../../types/result.js';
import { Maybe } from '../../types/util.js';
import { ifDefined } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { PlayerContext } from '../PlayerStreamContext.js';
import { ProgramStream } from '../ProgramStream.js';
import { PlexStreamDetails } from './PlexStreamDetails.js';

export class PlexProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: PlexProgramStream.name,
  });

  private killed = false;
  private updatePlexStatusTask: Maybe<UpdatePlexPlayStatusScheduledTask>;

  constructor(
    context: PlayerContext,
    outputFormat: OutputFormat,
    settingsDB: SettingsDB = getSettings(),
    private mediaSourceDB: MediaSourceDB = new MediaSourceDB(new ChannelDB()),
  ) {
    super(context, outputFormat, settingsDB);
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

    const ffmpegSettings = this.settingsDB.ffmpegSettings();
    const channel = this.context.channel;
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
    const plexStreamDetails = new PlexStreamDetails(server);

    const watermark = await this.getWatermark();
    const ffmpeg = this.context.useNewPipeline
      ? new FfmpegStreamFactory(ffmpegSettings, channel)
      : new FFMPEG(ffmpegSettings, channel, this.context.audioOnly); // Set the transcoder options

    const stream = await plexStreamDetails.getStream(lineupItem);
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

    const start = dayjs.duration(lineupItem.start ?? 0);

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
      ...(opts ?? {}),
    });

    if (isUndefined(transcodeSession)) {
      return Result.failure(new Error('Unable to create ffmpeg process'));
    }

    if (plexSettings.updatePlayStatus) {
      this.updatePlexStatusTask = new UpdatePlexPlayStatusScheduledTask(
        server,
        {
          channelNumber: channel.number,
          duration: lineupItem.duration,
          ratingKey: lineupItem.externalKey,
          startTime: lineupItem.start ?? 0,
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
