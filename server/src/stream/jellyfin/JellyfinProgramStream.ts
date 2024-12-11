import { SettingsDB } from '@/db/SettingsDB.ts';
import { isContentBackedLineupIteam } from '@/db/derived_types/StreamLineup.ts';
import { MediaSourceDB } from '@/db/mediaSourceDB.ts';
import { MediaSourceType } from '@/db/schema/MediaSource.ts';
import { JellyfinItemFinder } from '@/external/jellyfin/JellyfinItemFinder.ts';
import { FFmpegFactory } from '@/ffmpeg/FFmpegFactory.ts';
import { FfmpegTranscodeSession } from '@/ffmpeg/FfmpegTrancodeSession.js';
import { OutputFormat } from '@/ffmpeg/builder/constants.ts';
import { IFFMPEG } from '@/ffmpeg/ffmpegBase.ts';
import { PlayerContext } from '@/stream/PlayerStreamContext.js';
import { ProgramStream } from '@/stream/ProgramStream.js';
import { UpdateJellyfinPlayStatusScheduledTask } from '@/tasks/jellyfin/UpdateJellyfinPlayStatusTask.js';
import { Result } from '@/types/result.js';
import { Maybe, Nullable } from '@/types/util.js';
import { Provider } from '@/util/Provider.ts';
import { ifDefined } from '@/util/index.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import dayjs from 'dayjs';
import { isNil, isNull, isUndefined } from 'lodash-es';
import { ProgramStreamFactory } from '../ProgramStreamFactory.ts';
import { JellyfinStreamDetails } from './JellyfinStreamDetails.js';

export class JellyfinProgramStreamFactory implements ProgramStreamFactory {
  constructor(
    private settingsDB: SettingsDB,
    private mediaSourceDB: MediaSourceDB,
    private jellyfinItemFinderProvider: Provider<JellyfinItemFinder>,
  ) {}

  build(context: PlayerContext, outputFormat: OutputFormat): ProgramStream {
    return new JellyfinProgramStream(
      this.settingsDB,
      this.mediaSourceDB,
      this.jellyfinItemFinderProvider,
      context,
      outputFormat,
    );
  }
}

export class JellyfinProgramStream extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: JellyfinProgramStream.name,
  });
  private ffmpeg: Nullable<IFFMPEG> = null;
  private killed: boolean = false;
  private updatePlayStatusTask: Maybe<UpdateJellyfinPlayStatusScheduledTask>;

  constructor(
    settingsDB: SettingsDB,
    private mediaSourceDB: MediaSourceDB,
    private jellyfinItemFinderProvider: Provider<JellyfinItemFinder>,
    context: PlayerContext,
    outputFormat: OutputFormat,
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
          'Lineup item is not backed by a media source: ' +
            JSON.stringify(lineupItem),
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

    const jellyfinStreamDetails = new JellyfinStreamDetails(
      this.settingsDB,
      this.jellyfinItemFinderProvider.get(),
    );

    const watermark = await this.getWatermark();
    this.ffmpeg = FFmpegFactory.getFFmpegPipelineBuilder(
      ffmpegSettings,
      channel,
    );

    const stream = await jellyfinStreamDetails.getStream({
      server,
      item: lineupItem,
    });
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
