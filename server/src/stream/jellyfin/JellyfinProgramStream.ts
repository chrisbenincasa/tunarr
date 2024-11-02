import dayjs from 'dayjs';
import { isNil, isNull, isUndefined } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';
import { isContentBackedLineupIteam } from '../../dao/derived_types/StreamLineup.js';
import { MediaSourceType } from '../../dao/direct/schema/MediaSource.ts';
import { MediaSourceDB } from '../../dao/mediaSourceDB.js';
import { SettingsDB, getSettings } from '../../dao/settings.js';
import { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.js';
import { OutputFormat } from '../../ffmpeg/OutputFormat.js';
import { FFMPEG } from '../../ffmpeg/ffmpeg.js';
import { UpdateJellyfinPlayStatusScheduledTask } from '../../tasks/jellyfin/UpdateJellyfinPlayStatusTask.js';
import { Result } from '../../types/result.js';
import { Maybe, Nullable } from '../../types/util.js';
import { ifDefined } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { PlayerContext } from '../PlayerStreamContext.js';
import { ProgramStream } from '../ProgramStream.js';
import { JellyfinStreamDetails } from './JellyfinStreamDetails.js';

export class JellyfinProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: JellyfinProgramStream.name,
  });
  private ffmpeg: Nullable<FFMPEG> = null;
  private killed: boolean = false;
  private updatePlayStatusTask: Maybe<UpdateJellyfinPlayStatusScheduledTask>;

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
    ifDefined(this.updatePlayStatusTask, (task) => {
      task.stop();
    });
  }

  async setupInternal(): Promise<Result<FfmpegTranscodeSession>> {
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
      MediaSourceType.Jellyfin,
      lineupItem.externalSourceId,
    );

    if (isNil(server)) {
      return Result.failure(
        new Error(
          `Unable to find server "${lineupItem.externalSourceId}" specified by program.`,
        ),
      );
    }

    // const plexSettings = this.context.settings.plexSettings();
    const jellyfinStreamDetails = new JellyfinStreamDetails(
      server,
      this.settingsDB,
      // new ProgramDB(),
    );

    const watermark = await this.getWatermark();
    this.ffmpeg = new FFMPEG(ffmpegSettings, channel, this.context.audioOnly); // Set the transcoder options

    const stream = await jellyfinStreamDetails.getStream(lineupItem);
    if (isNull(stream)) {
      return Result.failure(
        new Error('Unable to retrieve stream details from Jellyfin'),
      );
    }

    if (this.killed) {
      return Result.failure(new Error('Stream was killed already, returning'));
    }

    const streamStats = stream.streamDetails;
    if (streamStats) {
      streamStats.duration = lineupItem.streamDuration
        ? dayjs.duration(lineupItem.streamDuration)
        : undefined;
    }

    const start = dayjs.duration(lineupItem.start ?? 0);

    const ffmpegOutStream = await this.ffmpeg.createStreamSession({
      streamSource: stream.streamSource,
      streamDetails: stream.streamDetails,
      startTime: start,
      duration:
        +start === 0
          ? dayjs.duration(lineupItem.duration)
          : dayjs.duration(lineupItem.streamDuration ?? lineupItem.duration),
      watermark,
      realtime: this.context.realtime,
      extraInputHeaders: {},
      outputFormat: this.outputFormat,
    });

    if (isUndefined(ffmpegOutStream)) {
      return Result.failure(new Error('Unable to spawn ffmpeg'));
    }

    return Result.success(ffmpegOutStream);
  }
}
