import constants from '@tunarr/shared/constants';
import { isNil, isNull, isUndefined } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';
import { isContentBackedLineupIteam } from '../../dao/derived_types/StreamLineup.js';
import { MediaSourceType } from '../../dao/entities/MediaSource.js';
import { MediaSourceDB } from '../../dao/mediaSourceDB.js';
import { ProgramDB } from '../../dao/programDB.js';
import { SettingsDB, getSettings } from '../../dao/settings.js';
import { FfmpegTranscodeSession } from '../../ffmpeg/FfmpegTrancodeSession.js';
import { FFMPEG } from '../../ffmpeg/ffmpeg.js';
import { UpdateJellyfinPlayStatusScheduledTask } from '../../tasks/jellyfin/UpdateJellyfinPlayStatusTask.js';
import { Maybe, Nullable } from '../../types/util.js';
import { ifDefined, isDefined } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { PlayerContext } from '../PlayerStreamContext.js';
import { ProgramStream } from '../ProgramStream.js';
import { JellyfinStreamDetails } from './JellyfinStreamDetails.js';

export class JellyfinProgramStreama extends ProgramStream {
  protected logger = LoggerFactory.child({
    caller: import.meta,
    className: JellyfinProgramStreama.name,
  });
  private ffmpeg: Nullable<FFMPEG> = null;
  private killed: boolean = false;
  private updatePlayStatusTask: Maybe<UpdateJellyfinPlayStatusScheduledTask>;

  constructor(
    context: PlayerContext,
    settingsDB: SettingsDB = getSettings(),
    private mediaSourceDB: MediaSourceDB = new MediaSourceDB(new ChannelDB()),
  ) {
    super(context, settingsDB);
  }

  protected shutdownInternal() {
    this.killed = true;
    ifDefined(this.updatePlayStatusTask, (task) => {
      task.stop();
    });
  }

  async setupInternal(): Promise<FfmpegTranscodeSession> {
    const lineupItem = this.context.lineupItem;
    if (!isContentBackedLineupIteam(lineupItem)) {
      throw new Error(
        'Lineup item is not backed by Plex: ' + JSON.stringify(lineupItem),
      );
    }

    const ffmpegSettings = this.settingsDB.ffmpegSettings();
    const channel = this.context.channel;
    const server = await this.mediaSourceDB.findByType(
      MediaSourceType.Jellyfin,
      lineupItem.externalSourceId,
    );

    if (isNil(server)) {
      throw new Error(
        `Unable to find server "${lineupItem.externalSourceId}" specified by program.`,
      );
    }

    // const plexSettings = this.context.settings.plexSettings();
    const jellyfinStreamDetails = new JellyfinStreamDetails(
      server,
      this.settingsDB,
      new ProgramDB(),
    );

    const watermark = this.getWatermark();
    this.ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    this.ffmpeg.setAudioOnly(this.context.audioOnly);

    let streamDuration: number | undefined;

    if (
      !isUndefined(lineupItem.streamDuration) &&
      (lineupItem.start ?? 0) + lineupItem.streamDuration + constants.SLACK <
        lineupItem.duration
    ) {
      streamDuration = lineupItem.streamDuration / 1000;
    }

    const stream = await jellyfinStreamDetails.getStream(lineupItem);
    if (isNull(stream)) {
      throw new Error('Unable to retrieve stream details from Jellyfin');
    }

    if (this.killed) {
      throw new Error('Stream was killed already, returning');
    }

    if (isDefined(stream.streamDetails)) {
      stream.streamDetails.duration = lineupItem.streamDuration;
    }

    const ffmpegOutStream = await this.ffmpeg.createStreamSession(
      stream.streamUrl,
      stream.streamDetails,
      // Don't use FFMPEG's -ss parameter for Jellyfin since we need to request
      // the seek against their API instead
      (lineupItem.start ?? 0) / 1000,
      streamDuration ?? lineupItem.duration,
      watermark,
      this.context.realtime,
      {
        // TODO: Use the real authorization string
        'X-Emby-Token': server.accessToken,
      },
    );

    if (isUndefined(ffmpegOutStream)) {
      throw new Error('Unable to spawn ffmpeg');
    }

    return ffmpegOutStream;
  }
}
